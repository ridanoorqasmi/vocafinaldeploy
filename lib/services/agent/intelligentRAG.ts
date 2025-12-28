/**
 * Intelligent RAG System - ChatGPT-level Document Reasoning Assistant
 * Handles multi-query retrieval, re-ranking, intent understanding, and structured outputs
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
  chunkId: string;
  documentId: string;
  documentName?: string;
  sectionHeading?: string;
}

interface IntentAnalysis {
  intent: 'definition' | 'procedure' | 'decision' | 'summary' | 'comparison' | 'explanation' | 'extraction' | 'action' | 'general';
  restatedQuestion: string;
  relatedQueries: string[];
  outputFormat?: 'bullets' | 'table' | 'checklist' | 'comparison' | 'plain';
  requiresReasoning: boolean;
}

interface RAGAnswerResult {
  answer: string;
  confidence: 'High' | 'Medium' | 'Low';
  citations: Array<{
    documentName: string;
    sectionHeading?: string;
    chunkId: string;
  }>;
  relevantChunks: number;
  coverage: 'complete' | 'partial' | 'insufficient';
  missingInfo?: string;
  followUpQuestion?: string;
}

/**
 * Step A: Understand the intent and restate the question (Optimized)
 * Uses fast-path for simple questions to skip LLM call
 */
async function analyzeIntent(question: string, fastPath?: { isSimple: boolean; requiresFullReasoning: boolean }): Promise<IntentAnalysis> {
  // Fast-path: Skip LLM for simple questions
  if (fastPath?.isSimple && !fastPath.requiresFullReasoning) {
    return {
      intent: 'general',
      restatedQuestion: question,
      relatedQueries: [question], // Single query for simple questions
      outputFormat: 'plain',
      requiresReasoning: false
    };
  }

  // Optimized prompt (shorter, more focused)
  const systemPrompt = `Analyze question and return JSON:
{
  "intent": "definition|procedure|decision|summary|comparison|explanation|extraction|action|general",
  "restatedQuestion": "clearer version",
  "relatedQueries": ["query1", "query2", "query3"],
  "outputFormat": "bullets|table|checklist|comparison|plain",
  "requiresReasoning": true|false
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.2, // Lower temperature for faster, more consistent responses
      response_format: { type: 'json_object' },
      max_tokens: 200 // Limit tokens for faster response
    });

    const analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
    
    return {
      intent: analysis.intent || 'general',
      restatedQuestion: analysis.restatedQuestion || question,
      relatedQueries: analysis.relatedQueries || [question],
      outputFormat: analysis.outputFormat || 'plain',
      requiresReasoning: analysis.requiresReasoning !== false
    };
  } catch (error) {
    console.error('Error analyzing intent:', error);
    // Fallback to simple analysis
    return {
      intent: 'general',
      restatedQuestion: question,
      relatedQueries: [question],
      outputFormat: 'plain',
      requiresReasoning: false
    };
  }
}

/**
 * Step B: Multi-query retrieval - Optimized with session cache and parallel execution
 */
async function multiQueryRetrieval(
  question: string,
  relatedQueries: string[],
  tenantId: string,
  conversationId: string | undefined,
  maxChunksPerQuery: number = 10,
  useMultiQuery: boolean = true
): Promise<RelevantChunk[]> {
  // Check session cache first
  const { getSessionCachedChunks, setSessionCachedChunks } = await import('./sessionCache');
  const cachedChunks = getSessionCachedChunks(conversationId, question);
  if (cachedChunks && cachedChunks.length > 0) {
    return cachedChunks as RelevantChunk[];
  }

  const allChunks: Map<string, RelevantChunk> = new Map();

  // For simple questions, use single query only
  const queries = useMultiQuery 
    ? [question, ...relatedQueries].slice(0, 5) // Max 5 queries
    : [question]; // Single query for fast-path

  // Parallelize embedding generation for multiple queries
  const embeddingPromises = queries.map(query => generateEmbedding(query));
  const embeddings = await Promise.all(embeddingPromises);

  // Get all chunks once (more efficient than per-query)
  const allChunksData = await prisma.kbChunk.findMany({
    where: { tenantId },
    select: {
      id: true,
      content: true,
      embedding: true,
      documentId: true,
      document: {
        select: {
          filename: true
        }
      }
    }
  });

  // Process all queries in parallel
  await Promise.all(
    queries.map(async (query, queryIndex) => {
      const questionEmbedding = embeddings[queryIndex];

      for (const chunk of allChunksData) {
        let embeddingArray: number[];
        
        if (Array.isArray(chunk.embedding)) {
          embeddingArray = chunk.embedding as number[];
        } else if (typeof chunk.embedding === 'string') {
          embeddingArray = JSON.parse(chunk.embedding);
        } else {
          continue;
        }

        try {
          const similarity = cosineSimilarity(questionEmbedding, embeddingArray);
          
          // Only include chunks with reasonable similarity
          if (similarity >= 0.6 && chunk.content && chunk.content.trim().length >= 50 && !isFormContent(chunk.content)) {
            const chunkKey = chunk.id;
            
            // Keep the highest similarity score for each chunk
            if (!allChunks.has(chunkKey) || allChunks.get(chunkKey)!.similarity < similarity) {
              allChunks.set(chunkKey, {
                content: chunk.content.trim(),
                similarity,
                chunkId: chunk.id,
                documentId: chunk.documentId,
                documentName: chunk.document?.filename || 'Unknown Document',
                sectionHeading: extractSectionHeading(chunk.content)
              });
            }
          }
        } catch (error) {
          continue;
        }
      }
    })
  );

  const result = Array.from(allChunks.values()).sort((a, b) => b.similarity - a.similarity);
  
  // Cache result in session
  setSessionCachedChunks(conversationId, question, result);
  
  return result;
}

/**
 * Step C: Re-rank chunks for better relevance
 */
async function rerankChunks(
  question: string,
  chunks: RelevantChunk[],
  topK: number = 8
): Promise<RelevantChunk[]> {
  if (chunks.length <= topK) {
    return chunks;
  }

  // Use cross-encoder style re-ranking with LLM
  // For now, use similarity + content length + keyword matching as heuristics
  const scoredChunks = chunks.map(chunk => {
    let score = chunk.similarity;
    
    // Boost score for longer, more complete chunks
    if (chunk.content.length > 200) score += 0.05;
    if (chunk.content.length > 500) score += 0.05;
    
    // Boost score if question keywords appear in content
    const questionWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const contentLower = chunk.content.toLowerCase();
    const keywordMatches = questionWords.filter(word => contentLower.includes(word)).length;
    score += (keywordMatches / questionWords.length) * 0.1;
    
    return { ...chunk, rerankScore: score };
  });

  // Sort by rerank score and return top K
  return scoredChunks
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, topK)
    .map(({ rerankScore, ...chunk }) => chunk);
}

/**
 * Step D: Validate coverage and determine confidence
 */
function validateCoverage(
  question: string,
  chunks: RelevantChunk[]
): { coverage: 'complete' | 'partial' | 'insufficient'; confidence: 'High' | 'Medium' | 'Low'; missingInfo?: string } {
  if (chunks.length === 0) {
    return {
      coverage: 'insufficient',
      confidence: 'Low',
      missingInfo: 'No relevant information found in the documents.'
    };
  }

  const avgSimilarity = chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length;
  const maxSimilarity = Math.max(...chunks.map(c => c.similarity));

  if (maxSimilarity >= 0.8 && avgSimilarity >= 0.75 && chunks.length >= 3) {
    return { coverage: 'complete', confidence: 'High' };
  } else if (maxSimilarity >= 0.7 && avgSimilarity >= 0.65 && chunks.length >= 2) {
    return { coverage: 'partial', confidence: 'Medium' };
  } else if (maxSimilarity >= 0.65) {
    return {
      coverage: 'partial',
      confidence: 'Medium',
      missingInfo: 'The documents may contain partial information. Some details might be missing.'
    };
  } else {
    return {
      coverage: 'insufficient',
      confidence: 'Low',
      missingInfo: 'The documents contain limited information about this topic.'
    };
  }
}

/**
 * Step E: Synthesize intelligent answer with enhanced session memory and tone adjustment
 */
async function synthesizeIntelligentAnswer(
  question: string,
  restatedQuestion: string,
  chunks: RelevantChunk[],
  intent: IntentAnalysis,
  coverage: { coverage: string; confidence: string; missingInfo?: string },
  conversationHistory: Array<{ role: 'user' | 'agent'; content: string }> = [],
  sessionContext?: any,
  sessionContextPrompt?: string,
  isFollowUp?: boolean,
  alreadyExplained?: boolean,
  supportIntent?: { intent: string; confidence: number; sentiment?: string }
): Promise<string> {
  if (chunks.length === 0) {
    return "I don't have information about that in the uploaded documents. The question isn't relevant to the content I have access to. Could you please rephrase your question or ask about something else?";
  }

  // Build context from chunks
  const context = chunks
    .map((chunk, index) => {
      const heading = chunk.sectionHeading ? `\n[Section: ${chunk.sectionHeading}]` : '';
      return `[Document: ${chunk.documentName}${heading}]\n${chunk.content}`;
    })
    .join('\n\n---\n\n');

  // Build format instructions based on intent
  let formatInstructions = '';
  switch (intent.outputFormat) {
    case 'bullets':
      formatInstructions = 'Format your answer as a bulleted list with key points.';
      break;
    case 'table':
      formatInstructions = 'Format your answer as a table if applicable, otherwise use a structured list.';
      break;
    case 'checklist':
      formatInstructions = 'Format your answer as a step-by-step checklist or action plan.';
      break;
    case 'comparison':
      formatInstructions = 'Format your answer as a side-by-side comparison table or structured comparison.';
      break;
    default:
      formatInstructions = 'Format your answer in clear, natural paragraphs.';
  }

  const reasoningInstructions = intent.requiresReasoning
    ? 'Include reasoning and explanation. Explain the "why" and "how" behind the information.'
    : 'Provide a direct, clear answer.';

  // Build enhanced session context prompt
  const hasSessionContext = sessionContextPrompt && sessionContextPrompt.length > 0;
  const isFollowUpQuestion = isFollowUp || false;
  const wasAlreadyExplained = alreadyExplained || false;

  // Session memory instructions
  let sessionInstructions = '';
  if (hasSessionContext) {
    if (isFollowUpQuestion) {
      sessionInstructions = `\n\nIMPORTANT - This is a FOLLOW-UP question. You MUST:
- Reference the previous conversation naturally
- Build on what was already discussed
- Do NOT repeat full explanations unless specifically asked
- Resolve pronouns (it, this, that) using conversation context
- Provide progressive, continuous answers`;
    }
    
    if (wasAlreadyExplained) {
      sessionInstructions += `\n\nNOTE: This topic was already explained. Provide a brief answer or build on previous explanation.`;
    }
  }

  // Tone adjustment based on support intent
  const toneInstructions = getToneInstructions(supportIntent);

  // Optimized prompt with session memory awareness and tone adjustment
  const systemPrompt = `Answer using ONLY the document context. Rules:
1. Use only information from documents below
2. No hallucinations
3. If no answer in documents, say: "I don't have information about that in the documents"
4. Answer directly, then ${reasoningInstructions}
5. ${formatInstructions}
6. Natural language (no raw text)
${hasSessionContext ? `7. CRITICAL - Session Memory:\n${sessionContextPrompt}${sessionInstructions}\n\nYou are continuing a conversation. Be aware of what was already discussed.` : ''}
${toneInstructions ? `8. TONE & STYLE:\n${toneInstructions}\n\nAdjust your tone and delivery style accordingly. Do NOT mention intent labels or sound robotic.` : ''}

Q: ${question}
Intent: ${intent.intent}
Documents:
${context}`;

  const userPrompt = question + (coverage.missingInfo ? `\nNote: ${coverage.missingInfo}` : '');

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2, // Lower for faster, more consistent responses
      max_tokens: intent.requiresReasoning ? 1500 : 800 // Shorter for simple questions
    });

    let answer = response.choices[0]?.message?.content?.trim() || '';
    
    // Validate answer quality
    if (answer.length === 0) {
      return "I don't have information about that in the uploaded documents. Could you please rephrase your question?";
    }

    // Add coverage note if partial
    if (coverage.coverage === 'partial' && coverage.missingInfo) {
      answer += `\n\n*Note: ${coverage.missingInfo}`;
    }

    return answer;
  } catch (error) {
    console.error('Error synthesizing answer:', error);
    // Fallback to best chunk
    if (chunks.length > 0) {
      return chunks[0].content.substring(0, 800);
    }
    return "I encountered an error processing your question. Please try again.";
  }
}

/**
 * Get tone instructions based on support intent
 * Internal only - not shown to user
 */
function getToneInstructions(supportIntent?: { intent: string; confidence: number; sentiment?: string }): string {
  if (!supportIntent || supportIntent.confidence < 0.6) {
    return ''; // No tone adjustment for low confidence
  }

  const intent = supportIntent.intent;
  const sentiment = supportIntent.sentiment;

  switch (intent) {
    case 'faq':
    case 'policy':
      return `TONE GUIDANCE: Respond with clear, neutral, professional tone. Be direct and factual. Use straightforward language. Do NOT sound robotic or overly formal. Write naturally as a helpful support agent.`;

    case 'how_to':
      return `TONE GUIDANCE: Be supportive, step-by-step, and encouraging. Break down processes into clear, numbered steps when helpful. Use positive language like "Here's how..." or "You can do this by...". Be patient and thorough. Make the user feel confident they can complete the task.`;

    case 'complaint':
      return `TONE GUIDANCE: Be calm, empathetic, and reassuring. Start by acknowledging their concern (e.g., "I understand your frustration" or "I'm sorry to hear about this"). Focus on solutions, not excuses. Be understanding without being defensive. Do NOT over-apologize, but show genuine care. End with a helpful next step.`;

    case 'pre_sales':
      return `TONE GUIDANCE: Be friendly, confident, and naturally enthusiastic. Highlight benefits and features that match their interest. Be honest and helpful. Use phrases like "Great question!" or "I'd be happy to explain...". Do NOT be pushy or salesy. Let the information speak for itself.`;

    case 'escalation_risk':
      return `TONE GUIDANCE: Be respectful, empathetic, and solution-oriented. Show urgency and understanding. Stay calm and professional. Focus on immediate, actionable solutions. If escalation is needed, offer it naturally (e.g., "I can connect you with a specialist" or "Let me get this to our team right away"). Do NOT dismiss their concern or sound dismissive.`;

    default:
      return ''; // No specific tone for general intents
  }
}

/**
 * Get conversation history for context
 */
async function getConversationHistory(
  conversationId: string,
  tenantId: string,
  limit: number = 5
): Promise<Array<{ role: 'user' | 'agent'; content: string }>> {
  try {
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        conversation: {
          tenantId
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit * 2, // Get more to filter
      select: {
        sender: true,
        text: true
      }
    });

    // Reverse to get chronological order and convert to chat format
    return messages
      .reverse()
      .slice(-limit) // Last N messages
      .map(msg => ({
        role: (msg.sender === 'user' ? 'user' : 'agent') as 'user' | 'agent',
        content: msg.text
      }));
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return [];
  }
}

/**
 * Main intelligent RAG function - Optimized for speed
 */
export async function generateIntelligentRAGAnswer(
  question: string,
  tenantId: string,
  conversationId?: string
): Promise<RAGAnswerResult> {
  const startTime = Date.now();
  const perfStart = Date.now();

  try {
    // Fast-path analysis (immediate, no LLM call)
    const fastPathStart = Date.now();
    const { analyzeFastPath, needsMultiQuery, getOptimalChunkCount } = await import('./fastPathAnalyzer');
    const fastPath = analyzeFastPath(question);
    const { logPerformance } = await import('./performanceMonitor');
    logPerformance('fast_path_analysis', Date.now() - fastPathStart);

    // Parallel: Get conversation history and analyze intent simultaneously
    const parallelStart = Date.now();
    const [conversationHistory, intent] = await Promise.all([
      conversationId ? getConversationHistory(conversationId, tenantId, 12) : Promise.resolve([]), // Get more history (12 messages) for comprehensive session context
      analyzeIntent(question, fastPath) // Fast-path may skip LLM call
    ]);
    logPerformance('parallel_intent_history', Date.now() - parallelStart);

    // Session Memory: Extract context and resolve follow-up questions
    const memoryStart = Date.now();
    const {
      extractSessionContext,
      isFollowUpQuestion,
      resolveQuestionContext,
      buildSessionContextPrompt,
      isAlreadyExplained
    } = await import('./sessionMemory');
    
    const sessionContext = extractSessionContext(conversationHistory);
    const isFollowUp = conversationHistory.length > 0 && isFollowUpQuestion(question, sessionContext);
    const resolvedQuestion = isFollowUp 
      ? resolveQuestionContext(question, sessionContext)
      : question;
    const sessionContextPrompt = buildSessionContextPrompt(sessionContext, conversationHistory);
    const alreadyExplained = isAlreadyExplained(question, sessionContext);
    
    // Support Intent Classification: Detect intent for tone adjustment
    const { classifySupportIntent } = await import('./supportIntentClassifier');
    const supportIntent = classifySupportIntent(question);
    
    logPerformance('session_memory', Date.now() - memoryStart);

    // Step B: Multi-query retrieval (optimized with session cache)
    // Use resolved question for better retrieval of follow-up questions
    const retrievalStart = Date.now();
    const useMultiQuery = needsMultiQuery(resolvedQuestion, fastPath);
    const optimalChunkCount = getOptimalChunkCount(fastPath);
    
    const retrievedChunks = await multiQueryRetrieval(
      resolvedQuestion, // Use resolved question for better context
      intent.relatedQueries,
      tenantId,
      conversationId,
      10,
      useMultiQuery
    );
    logPerformance('retrieval', Date.now() - retrievalStart);

    // Step C: Re-rank for better relevance (limit chunks for simple questions)
    const rerankStart = Date.now();
    const rerankedChunks = await rerankChunks(question, retrievedChunks, optimalChunkCount);
    logPerformance('rerank', Date.now() - rerankStart);

    // Step D: Validate coverage
    const coverage = validateCoverage(question, rerankedChunks);

    // Step E: Synthesize intelligent answer (with enhanced session context and tone adjustment)
    const synthesisStart = Date.now();
    const answer = await synthesizeIntelligentAnswer(
      question,
      intent.restatedQuestion,
      rerankedChunks,
      intent,
      coverage,
      conversationHistory,
      sessionContext,
      sessionContextPrompt,
      isFollowUp,
      alreadyExplained,
      supportIntent
    );
    logPerformance('synthesis', Date.now() - synthesisStart);

    // Generate citations
    const citations = rerankedChunks.slice(0, 5).map(chunk => ({
      documentName: chunk.documentName || 'Unknown Document',
      sectionHeading: chunk.sectionHeading,
      chunkId: chunk.chunkId
    }));

    // Generate follow-up question if coverage is insufficient
    let followUpQuestion: string | undefined;
    if (coverage.coverage === 'insufficient' && rerankedChunks.length > 0) {
      // Ask a targeted follow-up based on what we found
      followUpQuestion = `Would you like me to search for information about "${intent.relatedQueries[0]}" or is there a specific aspect you'd like me to focus on?`;
    }

    const duration = Date.now() - startTime;
    logPerformance('total_rag', duration, {
      chunks: rerankedChunks.length,
      confidence: coverage.confidence,
      complexity: fastPath.estimatedComplexity,
      cached: false
    });
    console.log(`[IntelligentRAG] Generated answer in ${duration}ms with ${rerankedChunks.length} chunks, confidence: ${coverage.confidence}, complexity: ${fastPath.estimatedComplexity}`);

    return {
      answer,
      confidence: coverage.confidence as 'High' | 'Medium' | 'Low',
      citations,
      relevantChunks: rerankedChunks.length,
      coverage: coverage.coverage as 'complete' | 'partial' | 'insufficient',
      missingInfo: coverage.missingInfo,
      followUpQuestion
    };
  } catch (error) {
    console.error('Error in intelligent RAG:', error);
    return {
      answer: "I encountered an error while processing your question. Please try again or rephrase your question.",
      confidence: 'Low',
      citations: [],
      relevantChunks: 0,
      coverage: 'insufficient'
    };
  }
}

/**
 * Helper: Extract section heading from content
 */
function extractSectionHeading(content: string): string | undefined {
  // Look for common heading patterns
  const headingPatterns = [
    /^(#{1,6})\s+(.+)$/m, // Markdown headings
    /^([A-Z][A-Z\s]{10,})$/, // ALL CAPS headings
    /^([A-Z][^.!?]{5,50}):$/, // Title case with colon
  ];

  const lines = content.split('\n').slice(0, 5); // Check first 5 lines
  for (const line of lines) {
    for (const pattern of headingPatterns) {
      const match = line.trim().match(pattern);
      if (match) {
        return match[match.length - 1].trim();
      }
    }
  }

  return undefined;
}

/**
 * Helper: Check if content looks like form content
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

