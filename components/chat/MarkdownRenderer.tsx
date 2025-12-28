'use client'

import React from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

/**
 * Professional Markdown Renderer for Chatbot Responses
 * Converts markdown syntax to styled UI components
 * Similar to ChatGPT, Notion, Slack rich text
 */
export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content) return null

  // Parse markdown and convert to React elements
  const renderMarkdown = (text: string): React.ReactNode => {
    const elements: React.ReactNode[] = []
    let currentIndex = 0
    let key = 0

    // Helper to add text node
    const addText = (text: string, styles: string = '') => {
      if (text) {
        elements.push(
          <span key={key++} className={styles}>
            {text}
          </span>
        )
      }
    }

    // Split by lines to handle block elements
    const lines = text.split('\n')
    let inCodeBlock = false
    let codeBlockLanguage = ''
    let codeBlockContent: string[] = []
    let inTable = false
    let tableRows: string[][] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()

      // Code blocks (```)
      if (trimmedLine.startsWith('```')) {
        if (inCodeBlock) {
          // End code block
          elements.push(
            <pre
              key={key++}
              className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 sm:p-4 my-3 overflow-x-auto"
            >
              <code className="text-sm text-gray-300 font-mono block whitespace-pre">
                {codeBlockContent.join('\n')}
              </code>
            </pre>
          )
          codeBlockContent = []
          inCodeBlock = false
          codeBlockLanguage = ''
        } else {
          // Start code block
          codeBlockLanguage = trimmedLine.slice(3).trim()
          inCodeBlock = true
        }
        continue
      }

      if (inCodeBlock) {
        codeBlockContent.push(line)
        continue
      }

      // Tables
      if (trimmedLine.includes('|') && trimmedLine.split('|').length > 2) {
        if (!inTable) {
          inTable = true
          tableRows = []
        }
        const cells = trimmedLine
          .split('|')
          .map(cell => cell.trim())
          .filter(cell => cell.length > 0)
        
        // Skip separator rows (---)
        if (cells.every(cell => /^:?-+:?$/.test(cell))) {
          continue
        }
        
        tableRows.push(cells)
        continue
      } else if (inTable) {
        // End table
        if (tableRows.length > 0) {
          elements.push(renderTable(tableRows, key))
          key += tableRows.length + 1
        }
        tableRows = []
        inTable = false
      }

      // Headings
      if (trimmedLine.startsWith('###')) {
        const headingText = trimmedLine.slice(3).trim()
        elements.push(
          <h3 key={key++} className="text-base sm:text-lg font-semibold mt-4 mb-2 text-white">
            {renderInlineMarkdown(headingText)}
          </h3>
        )
        continue
      } else if (trimmedLine.startsWith('##')) {
        const headingText = trimmedLine.slice(2).trim()
        elements.push(
          <h2 key={key++} className="text-lg sm:text-xl font-bold mt-5 mb-3 text-white">
            {renderInlineMarkdown(headingText)}
          </h2>
        )
        continue
      } else if (trimmedLine.startsWith('#')) {
        const headingText = trimmedLine.slice(1).trim()
        elements.push(
          <h1 key={key++} className="text-xl sm:text-2xl font-bold mt-6 mb-4 text-white">
            {renderInlineMarkdown(headingText)}
          </h1>
        )
        continue
      }

      // Horizontal rule
      if (trimmedLine === '---' || trimmedLine === '***') {
        elements.push(
          <hr key={key++} className="my-4 border-gray-700" />
        )
        continue
      }

      // Lists
      if (/^[-*+]\s/.test(trimmedLine) || /^\d+\.\s/.test(trimmedLine)) {
        const listItems: string[] = []
        let j = i
        const isOrdered = /^\d+\.\s/.test(trimmedLine)
        
        while (j < lines.length) {
          const listLine = lines[j].trim()
          if (isOrdered && /^\d+\.\s/.test(listLine)) {
            listItems.push(listLine.replace(/^\d+\.\s/, ''))
            j++
          } else if (!isOrdered && /^[-*+]\s/.test(listLine)) {
            listItems.push(listLine.replace(/^[-*+]\s/, ''))
            j++
          } else if (listLine === '' && j < lines.length - 1) {
            // Empty line might be part of list if next line is also list item
            j++
            continue
          } else {
            break
          }
        }
        
        if (listItems.length > 0) {
          elements.push(
            <ul
              key={key++}
              className={`my-2 space-y-1.5 ${isOrdered ? 'list-decimal list-inside' : 'list-disc list-inside'} pl-4`}
            >
              {listItems.map((item, idx) => (
                <li key={idx} className="text-sm sm:text-base leading-relaxed text-gray-200">
                  {renderInlineMarkdown(item)}
                </li>
              ))}
            </ul>
          )
          i = j - 1
          continue
        }
      }

      // Citations/Sources (lines starting with *Note: or *Sources:)
      if (trimmedLine.startsWith('*Note:') || trimmedLine.startsWith('*Sources:') || trimmedLine.startsWith('Note:') || trimmedLine.startsWith('Sources:')) {
        const citationText = trimmedLine.replace(/^(\*)?(Note|Sources):\s*/, '$2: ').trim()
        elements.push(
          <div key={key++} className="mt-4 pt-3 border-t border-gray-700/50">
            <p className="text-xs sm:text-sm leading-relaxed text-gray-400 italic">
              {renderInlineMarkdown(citationText)}
            </p>
          </div>
        )
        continue
      }

      // Regular paragraph
      if (trimmedLine) {
        elements.push(
          <p key={key++} className="text-sm sm:text-base leading-relaxed text-gray-200 mb-2">
            {renderInlineMarkdown(trimmedLine)}
          </p>
        )
      } else if (i < lines.length - 1) {
        // Empty line for spacing
        elements.push(<br key={key++} />)
      }
    }

    // Handle remaining code block or table
    if (inCodeBlock && codeBlockContent.length > 0) {
      elements.push(
        <pre
          key={key++}
          className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 sm:p-4 my-3 overflow-x-auto"
        >
          <code className="text-sm text-gray-300 font-mono block whitespace-pre">
            {codeBlockContent.join('\n')}
          </code>
        </pre>
      )
    }
    if (inTable && tableRows.length > 0) {
      elements.push(renderTable(tableRows, key))
    }

    return elements.length > 0 ? <>{elements}</> : null
  }

  // Render inline markdown (bold, italic, links, code)
  const renderInlineMarkdown = (text: string): React.ReactNode => {
    if (!text) return null

    const parts: React.ReactNode[] = []
    let partKey = 0

    // Process text in order: code, bold, italic, links
    let processedText = text
    const processedParts: Array<{ start: number; end: number; type: string; content: string; extra?: string }> = []

    // 1. Find code blocks first (highest priority)
    const codeRegex = /`([^`]+)`/g
    let codeMatch
    while ((codeMatch = codeRegex.exec(text)) !== null) {
      processedParts.push({
        start: codeMatch.index,
        end: codeMatch.index + codeMatch[0].length,
        type: 'code',
        content: codeMatch[1]
      })
    }

    // 2. Find bold (must not be part of code)
    const boldRegex = /\*\*([^*]+)\*\*/g
    let boldMatch
    while ((boldMatch = boldRegex.exec(text)) !== null) {
      // Check if it's inside a code block
      const isInCode = processedParts.some(p => p.type === 'code' && boldMatch!.index >= p.start && boldMatch!.index < p.end)
      if (!isInCode) {
        processedParts.push({
          start: boldMatch.index,
          end: boldMatch.index + boldMatch[0].length,
          type: 'bold',
          content: boldMatch[1]
        })
      }
    }

    // 3. Find italic (must not be part of code or bold)
    const italicRegex = /\*([^*\n]+?)\*/g
    let italicMatch
    while ((italicMatch = italicRegex.exec(text)) !== null) {
      // Check if it's inside code or bold
      const isInCode = processedParts.some(p => p.type === 'code' && italicMatch!.index >= p.start && italicMatch!.index < p.end)
      const isInBold = processedParts.some(p => p.type === 'bold' && italicMatch!.index >= p.start && italicMatch!.index < p.end)
      // Skip if it's part of **bold** pattern
      const isBoldPattern = text.substring(Math.max(0, italicMatch.index - 1), Math.min(text.length, italicMatch.index + italicMatch[0].length + 1)).includes('**')
      
      if (!isInCode && !isInBold && !isBoldPattern) {
        processedParts.push({
          start: italicMatch.index,
          end: italicMatch.index + italicMatch[0].length,
          type: 'italic',
          content: italicMatch[1]
        })
      }
    }

    // 4. Find links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    let linkMatch
    while ((linkMatch = linkRegex.exec(text)) !== null) {
      const isInCode = processedParts.some(p => p.type === 'code' && linkMatch!.index >= p.start && linkMatch!.index < p.end)
      if (!isInCode) {
        processedParts.push({
          start: linkMatch.index,
          end: linkMatch.index + linkMatch[0].length,
          type: 'link',
          content: linkMatch[1],
          extra: linkMatch[2]
        })
      }
    }

    // Sort by position
    processedParts.sort((a, b) => a.start - b.start)

    // Remove overlaps (keep first)
    const nonOverlapping: typeof processedParts = []
    for (const part of processedParts) {
      if (nonOverlapping.length === 0 || part.start >= nonOverlapping[nonOverlapping.length - 1].end) {
        nonOverlapping.push(part)
      }
    }

    // Build output
    let lastIndex = 0
    nonOverlapping.forEach((part) => {
      // Add text before
      if (part.start > lastIndex) {
        const textBefore = text.substring(lastIndex, part.start)
        if (textBefore) {
          parts.push(<span key={partKey++}>{textBefore}</span>)
        }
      }
      // Add formatted part
      switch (part.type) {
        case 'code':
          parts.push(
            <code key={partKey++} className="bg-gray-900/50 text-orange-400 px-1.5 py-0.5 rounded text-xs sm:text-sm font-mono">
              {part.content}
            </code>
          )
          break
        case 'bold':
          parts.push(
            <strong key={partKey++} className="font-semibold text-white">
              {part.content}
            </strong>
          )
          break
        case 'italic':
          parts.push(
            <em key={partKey++} className="italic text-gray-300">
              {part.content}
            </em>
          )
          break
        case 'link':
          parts.push(
            <a
              key={partKey++}
              href={part.extra}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300 underline break-all"
            >
              {part.content}
            </a>
          )
          break
      }
      lastIndex = part.end
    })

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(<span key={partKey++}>{text.substring(lastIndex)}</span>)
    }

    return parts.length > 0 ? <>{parts}</> : text
  }

  // Render table
  const renderTable = (rows: string[][], startKey: number): React.ReactNode => {
    if (rows.length === 0) return null

    const headerRow = rows[0]
    const dataRows = rows.slice(1)

    return (
      <div key={startKey} className="my-4 overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-700 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-800/50">
              {headerRow.map((cell, idx) => (
                <th
                  key={idx}
                  className="border border-gray-700 px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-white"
                >
                  {renderInlineMarkdown(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={rowIdx % 2 === 0 ? 'bg-gray-900/30' : 'bg-gray-800/20'}
              >
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="border border-gray-700 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-200"
                  >
                    {renderInlineMarkdown(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className={`markdown-content ${className} [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_h1]:mb-3 [&_h2]:mb-2 [&_h3]:mb-2 [&_pre]:my-3`}>
      {renderMarkdown(content)}
    </div>
  )
}

