/**
 * RAG-Based Answer Generator
 * Uses semantic search + LLM synthesis to generate ChatGPT-like answers from documents
 */

import { getOpenAIClient } from '@/lib/openai-client';
import { generateEmbedding } from '@/lib/services/kb/generateEmbedding';
import { cosineSimilarity } from '@/lib/openai-client';
import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();
const openai = getOpenAIClient();

interface RelevantChunk {
  content: string;
  similarity: number;
}

interface RAGAnswerResult {
  answer: string;
  relevantChunks: number;
  confidence: number;
  sources?: string[];
}

/**
 * Retrieves relevant chunks from KB using semantic search
 */
async function retrieveRelevantChunks(
  question: string,
  tenantId: string,
  maxChunks: number = 5,
  minSimilarity: number = 0.65
): Promise<RelevantChunk[]> {
  try {
    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question);

    // Get all chunks for the tenant
    const chunks = await prisma.kbChunk.findMany({
      where: { tenantId },
      select: {
        id: true,
        content: true,
        embedding: true,
        document: {
          select: {
            filename: true
          }
        }
      }
    });

    if (chunks.length === 0) {
      return [];
    }

    // Calculate similarity scores
    const similarities: RelevantChunk[] = chunks
      .map((chunk: any) => {
        let embeddingArray: number[];
        
        if (Array.isArray(chunk.embedding)) {
          embeddingArray = chunk.embedding as number[];
        } else if (typeof chunk.embedding === 'string') {
          embeddingArray = JSON.parse(chunk.embedding);
        } else {
          return null;
        }

        try {
          const similarity = cosineSimilarity(questionEmbedding, embeddingArray);
          return {
            content: chunk.content?.trim() || '',
            similarity
          };
        } catch (error) {
          console.error('Error calculating similarity:', error);
          return null;
        }
      })
      .filter((item): item is RelevantChunk => 
        item !== null && 
        item.similarity >= minSimilarity &&
        item.content.length >= 50 &&
        !isFormContent(item.content)
      );

    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Return top N chunks
    return similarities.slice(0, maxChunks);
  } catch (error) {
    console.error('Error retrieving relevant chunks:', error);
    return [];
  }
}

/**
 * Generates a natural, contextual answer using LLM with retrieved chunks as context
 */
async function synthesizeAnswer(
  question: string,
  relevantChunks: RelevantChunk[]
): Promise<string> {
  if (relevantChunks.length === 0) {
    return "I don't have information about that in the uploaded documents. Could you please rephrase your question or ask about something else?";
  }

  // Combine relevant chunks into context
  const context = relevantChunks
    .map((chunk, index) => `[Section ${index + 1}]\n${chunk.content}`)
    .join('\n\n---\n\n');

  // Calculate average similarity as confidence score
  const avgSimilarity = relevantChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / relevantChunks.length;

  // If similarity is too low, indicate uncertainty
  const isUncertain = avgSimilarity < 0.7;

  const systemPrompt = `You are a helpful AI assistant that answers questions based ONLY on the provided document context. 

CRITICAL RULES:
1. You MUST only use information from the provided context sections below
2. You MUST NOT make up, hallucinate, or add information not in the context
3. If the context doesn't contain the answer, say clearly: "The question isn't relevant to the uploaded documents" or "I don't have information about that in the documents"
4. Your answer should be:
   - Direct and clear
   - Written in natural, conversational language
   - Synthesized from the context (not copied verbatim)
   - Contextual and relevant to the question
5. Do NOT return entire sections or long paragraphs - synthesize and summarize
6. Do NOT list raw paragraphs - explain in your own words
7. If asked to summarize, provide a concise summary
8. If asked to explain, provide a clear explanation in simple terms

${isUncertain ? 'NOTE: The retrieved context has low relevance. Be cautious and indicate if the information might not fully answer the question.' : ''}

Context from documents:
${context}`;

  const userPrompt = `Question: ${question}

Please provide a clear, direct answer based ONLY on the context provided above. If the context doesn't contain relevant information, say so clearly.`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.3, // Lower temperature for more factual, consistent answers
      max_tokens: 1000,
      top_p: 0.9
    });

    const answer = response.choices[0]?.message?.content?.trim() || '';
    
    // Validate that answer doesn't hallucinate (basic check)
    if (answer.length === 0 || answer.toLowerCase().includes('i don\'t have access') && !answer.toLowerCase().includes('documents')) {
      return "I don't have information about that in the uploaded documents. Could you please rephrase your question?";
    }

    return answer;
  } catch (error) {
    console.error('Error synthesizing answer with LLM:', error);
    // Fallback to best chunk if LLM fails
    if (relevantChunks.length > 0) {
      return relevantChunks[0].content.substring(0, 500);
    }
    return "I encountered an error processing your question. Please try again.";
  }
}

/**
 * Main RAG function: Retrieves relevant chunks and synthesizes an answer
 */
export async function generateRAGAnswer(
  question: string,
  tenantId: string
): Promise<RAGAnswerResult> {
  const startTime = Date.now();

  try {
    // Step 1: Retrieve relevant chunks using semantic search
    const relevantChunks = await retrieveRelevantChunks(question, tenantId, 5, 0.65);

    if (relevantChunks.length === 0) {
      return {
        answer: "I don't have information about that in the uploaded documents. The question isn't relevant to the content I have access to. Could you please rephrase your question or ask about something else?",
        relevantChunks: 0,
        confidence: 0
      };
    }

    // Step 2: Synthesize answer using LLM
    const answer = await synthesizeAnswer(question, relevantChunks);

    // Calculate confidence based on average similarity
    const avgSimilarity = relevantChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / relevantChunks.length;

    const duration = Date.now() - startTime;
    console.log(`[RAG] Generated answer in ${duration}ms with ${relevantChunks.length} chunks, avg similarity: ${avgSimilarity.toFixed(3)}`);

    return {
      answer,
      relevantChunks: relevantChunks.length,
      confidence: avgSimilarity,
      sources: relevantChunks.map((_, i) => `Section ${i + 1}`)
    };
  } catch (error) {
    console.error('Error in RAG answer generation:', error);
    return {
      answer: "I encountered an error while processing your question. Please try again or rephrase your question.",
      relevantChunks: 0,
      confidence: 0
    };
  }
}

/**
 * Check if content looks like form content (should be filtered)
 */
function isFormContent(content: string): boolean {
  const formPatterns = [
    /^[a-z]+:\s*_+$/i,
    /^[a-z]+\s*:\s*$/i,
    /^\s*[a-z]+\s*:\s*[0-9]+\s*$/i,
  ];
  
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const formLineCount = lines.filter(line => 
    formPatterns.some(pattern => pattern.test(line))
  ).length;
  
  return formLineCount > lines.length * 0.5 && lines.length <= 5;
}




