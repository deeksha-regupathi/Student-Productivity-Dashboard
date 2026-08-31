/**
 * AI-Powered Recall Evaluation & Scoring Service
 * Provides evaluation of student answers against topic notes and key concepts.
 * Supports OpenAI / Gemini AI providers with an intelligent fallback engine.
 */

// Helper to determine recall level from score according to specifications
function getRecallLevel(score) {
  const rounded = Math.round(score);
  if (rounded >= 85) return "Excellent";
  if (rounded >= 70) return "Good";
  if (rounded >= 50) return "Needs Improvement";
  return "Weak";
}

// Ensure score is clamped between 0 and 100
function clampScore(score) {
  const num = Number(score);
  if (isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

/**
 * Text normalizer for intelligent concept analysis
 */
function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/\b1st\b/g, "first")
    .replace(/\b2nd\b/g, "second")
    .replace(/\b3rd\b/g, "third")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Intelligent Fallback Concept-Matching Evaluator
 * Used when no AI API key is configured or when external AI calls fail.
 */
function evaluateWithFallbackEngine({ topicNotes, topicQuestion, topicTitle, keyConcepts, studentAnswer }) {
  const rawAnswer = (studentAnswer || "").trim();
  const normalizedAnswer = normalizeText(rawAnswer);
  
  // Normalize concepts list
  let concepts = Array.isArray(keyConcepts) && keyConcepts.length > 0 ? keyConcepts : [];
  if (concepts.length === 0) {
    concepts = extractConceptsFromNotes(topicNotes);
  }

  const correct = [];
  const partial = [];
  const missed = [];

  // Stop words to filter out
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with", "by", 
    "about", "against", "between", "into", "through", "during", "before", "after", "above", 
    "below", "from", "up", "down", "is", "are", "was", "were", "be", "been", "being", 
    "have", "has", "had", "do", "does", "did", "can", "could", "should", "would", "that", 
    "this", "these", "those", "it", "its", "they", "them", "their", "which", "what", "how", "also"
  ]);

  // Clean words from student answer
  const answerWords = normalizedAnswer
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));
  const answerWordSet = new Set(answerWords);

  let totalWeight = 0;
  let earnedScore = 0;

  for (const concept of concepts) {
    const conceptName = concept.name || concept.title || "Key Concept";
    const conceptDesc = concept.description || "";
    const rawKeywords = Array.isArray(concept.keywords) && concept.keywords.length > 0
      ? concept.keywords
      : (conceptName + " " + conceptDesc).toLowerCase().replace(/[^\w\s-]/g, " ").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

    const keywords = rawKeywords.map(k => normalizeText(k)).filter(Boolean);
    const totalKeywords = keywords.length || 1;
    let matchedScore = 0;

    for (const kw of keywords) {
      const lowerKw = kw.toLowerCase().trim();
      if (lowerKw.length > 0) {
        // Check exact match or phrase containment in normalized answer
        if (normalizedAnswer.includes(lowerKw) || answerWordSet.has(lowerKw)) {
          matchedScore += 1.0;
        } else {
          // Check words within multi-word keyword
          const subTokens = lowerKw.split(/[\s-]+/).filter(t => t.length > 1 && !stopWords.has(t));
          if (subTokens.length > 1) {
            const subMatches = subTokens.filter(st => normalizedAnswer.includes(st) || answerWordSet.has(st)).length;
            if (subMatches > 0) {
              matchedScore += subMatches / subTokens.length;
            }
          } else {
            // Check stem match
            const stem = lowerKw.slice(0, Math.max(3, lowerKw.length - 2));
            const hasStem = answerWords.some(w => (w.length >= 3 && (w.startsWith(stem) || stem.startsWith(w))));
            if (hasStem) {
              matchedScore += 0.8;
            }
          }
        }
      }
    }

    const matchRatio = Math.min(1.0, matchedScore / totalKeywords);
    totalWeight += 1;

    if (matchRatio >= 0.40) {
      earnedScore += 1.0;
      correct.push(conceptName);
    } else if (matchRatio >= 0.15) {
      earnedScore += 0.5;
      partial.push(conceptName);
    } else {
      missed.push(conceptName);
    }
  }

  // Base score percentage (0-100)
  let rawScore = totalWeight > 0 ? (earnedScore / totalWeight) * 100 : 0;

  // Modest elaboration bonus for articulate responses
  if (rawAnswer.length > 180 && rawScore >= 60) {
    rawScore = Math.min(100, rawScore + 5);
  }

  const finalScore = clampScore(rawScore);
  const level = getRecallLevel(finalScore);

  // Generate constructive feedback
  let feedback = "";
  if (finalScore >= 85) {
    feedback = `Outstanding recall! You accurately captured ${correct.length} core concept${correct.length === 1 ? '' : 's'} with comprehensive detail and strong conceptual clarity.`;
  } else if (finalScore >= 70) {
    feedback = `Good job! You demonstrated solid understanding of key ideas, correctly recalling ${correct.length} concept${correct.length === 1 ? '' : 's'}. Refining the remaining details will bring you to mastery.`;
  } else if (finalScore >= 50) {
    feedback = `Fair attempt. You remembered basic elements (${correct.length} complete, ${partial.length} partial), but several crucial mechanisms and terminology were missed or incomplete.`;
  } else {
    feedback = `Needs review. You recalled few key concepts from the notes (${missed.length} missed). Re-reading the material and doing another active recall session is recommended.`;
  }

  // Generate tailored suggestions
  const suggestions = [];
  if (missed.length > 0) {
    suggestions.push(`Review the missed topics: ${missed.slice(0, 3).join(", ")}.`);
  }
  if (partial.length > 0) {
    suggestions.push(`Flesh out details for partially recalled concepts: ${partial.slice(0, 2).join(", ")}.`);
  }
  if (rawAnswer.length < 80) {
    suggestions.push("Try to explain the 'why' and 'how' behind each process rather than only listing names.");
  }
  if (finalScore < 70) {
    suggestions.push("Practice active recall again in 24 hours using spaced repetition to reinforce memory pathways.");
  } else {
    suggestions.push("Great work! Try formulating flashcards on edge cases or related application questions to solidify your knowledge.");
  }

  return {
    score: finalScore,
    level,
    correct_concepts: correct,
    partial_concepts: partial,
    missed_concepts: missed,
    feedback,
    suggestions
  };
}

/**
 * Fallback concept extractor for topics that don't have predefined key_concepts.
 */
function extractConceptsFromNotes(notes) {
  if (!notes) return [];
  
  const lines = notes.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const concepts = [];

  for (const line of lines) {
    const listMatch = line.match(/^(\d+\.|\*|-|•)\s*(.+)$/);
    if (listMatch) {
      const text = listMatch[2];
      const colonSplit = text.split(/:\s*/);
      if (colonSplit.length > 1) {
        concepts.push({
          name: colonSplit[0].replace(/[*_]/g, "").trim(),
          description: colonSplit[1].trim()
        });
      } else {
        concepts.push({
          name: text.slice(0, 40).trim(),
          description: text.trim()
        });
      }
    }
  }

  if (concepts.length === 0) {
    concepts.push({
      name: "Core Topic Content",
      description: notes.slice(0, 100)
    });
  }

  return concepts;
}

/**
 * AI Provider caller (Gemini / OpenAI if configured via environment)
 */
async function callAiProvider({ topicNotes, topicQuestion, topicTitle, keyConcepts, studentAnswer }) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    return null; // Trigger fallback
  }

  const promptText = `
You are an expert AI tutor evaluating a student's active recall attempt.

Topic: ${topicTitle}
Question Prompt: ${topicQuestion}

Original Study Notes / Source Material:
"""
${topicNotes}
"""

Key Concepts Reference:
${JSON.stringify(keyConcepts, null, 2)}

Student's Recalled Answer:
"""
${studentAnswer}
"""

Task:
Evaluate how accurately and completely the student recalled the key concepts from the original notes.
Classify the recall performance according to this exact scale:
- "Excellent": score 85–100
- "Good": score 70–84
- "Needs Improvement": score 50–69
- "Weak": score 0–49

Respond ONLY with a valid JSON object matching this schema:
{
  "score": <number between 0 and 100>,
  "level": "<'Excellent' | 'Good' | 'Needs Improvement' | 'Weak'>",
  "correct_concepts": [<array of concept names correctly recalled>],
  "partial_concepts": [<array of concept names partially recalled>],
  "missed_concepts": [<array of concept names missed>],
  "feedback": "<concise, constructive 2-3 sentence feedback explaining the score and key strengths/gaps>",
  "suggestions": [<array of 2-3 actionable improvement suggestions>]
}
`;

  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawContent) {
          const parsed = JSON.parse(rawContent.trim());
          const score = clampScore(parsed.score);
          return {
            score,
            level: getRecallLevel(score),
            correct_concepts: Array.isArray(parsed.correct_concepts) ? parsed.correct_concepts : [],
            partial_concepts: Array.isArray(parsed.partial_concepts) ? parsed.partial_concepts : [],
            missed_concepts: Array.isArray(parsed.missed_concepts) ? parsed.missed_concepts : [],
            feedback: parsed.feedback || "Evaluation complete.",
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
          };
        }
      }
    } catch (err) {
      console.warn("Gemini API call failed, falling back to local evaluator:", err.message);
    }
  }

  if (openaiKey) {
    try {
      const url = "https://api.openai.com/v1/chat/completions";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You evaluate student active recall against reference material. Always output valid JSON." },
            { role: "user", content: promptText }
          ],
          temperature: 0.2
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content;
        if (rawContent) {
          const parsed = JSON.parse(rawContent.trim());
          const score = clampScore(parsed.score);
          return {
            score,
            level: getRecallLevel(score),
            correct_concepts: Array.isArray(parsed.correct_concepts) ? parsed.correct_concepts : [],
            partial_concepts: Array.isArray(parsed.partial_concepts) ? parsed.partial_concepts : [],
            missed_concepts: Array.isArray(parsed.missed_concepts) ? parsed.missed_concepts : [],
            feedback: parsed.feedback || "Evaluation complete.",
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
          };
        }
      }
    } catch (err) {
      console.warn("OpenAI API call failed, falling back to local evaluator:", err.message);
    }
  }

  return null;
}

/**
 * Main Evaluation Entry Point
 */
async function evaluateRecall({ topicNotes, topicQuestion, topicTitle, keyConcepts, studentAnswer }) {
  // Validate student answer presence
  if (typeof studentAnswer !== "string" || studentAnswer.trim().length === 0) {
    const error = new Error("Student answer cannot be empty.");
    error.statusCode = 400;
    throw error;
  }

  const trimmed = studentAnswer.trim();
  if (trimmed.length < 8) {
    const error = new Error("Student answer is too short. Please provide a more detailed recall response.");
    error.statusCode = 400;
    throw error;
  }

  // Attempt AI provider evaluation if available
  const aiResult = await callAiProvider({
    topicNotes,
    topicQuestion,
    topicTitle,
    keyConcepts,
    studentAnswer: trimmed
  });

  if (aiResult) {
    return aiResult;
  }

  // Fallback to intelligent concept analysis engine
  return evaluateWithFallbackEngine({
    topicNotes,
    topicQuestion,
    topicTitle,
    keyConcepts,
    studentAnswer: trimmed
  });
}

module.exports = {
  evaluateRecall,
  getRecallLevel,
  clampScore,
  normalizeText,
  evaluateWithFallbackEngine
};
