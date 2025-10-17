'use client';

import { useEffect, useState } from 'react';

const MAX_ATTEMPTS = 5;
const TARGET_PERCENT = 90;

// Type definitions
interface Question {
  id: number;
  type: 'mcq' | 'short';
  prompt: string;
  choices?: string[];
  answer: string;
  rubric: string[];
  points: number;
}

interface TestResult {
  questions: Question[];
  totalPoints: number;
}

interface TestResponse {
  ok: boolean;
  result: TestResult;
  error?: string;
  raw?: string;
}

interface GradeResult {
  id: number;
  score: number;
  max: number;
  feedback: string;
  correct: boolean;
  expected: string;
}

interface GradeResponse {
  ok: boolean;
  result: {
    results: GradeResult[];
    totalScorePercent: number;
    totalPoints: number;
    earnedPoints: number;
  };
  error?: string;
  raw?: string;
}

interface ExplanationResult {
  brief?: string;
  explanation?: string;
  commonMistakes?: string[];
  correction?: string;
  // Enhanced explanation fields from Answer Explanation Agent
  diagnosis?: {
    mistakeType: string;
    severity: string;
    rootCause: string;
  };
  stepByStepExplanation?: {
    whatWentWrong: string;
    whyItsWrong: string;
    correctApproach: string;
    keyInsight: string;
  };
  visualBreakdown?: {
    studentThinking: string;
    correctThinking: string;
    comparisonTable: Array<{
      aspect: string;
      student: string;
      correct: string;
      impact: string;
    }>;
  };
  practiceExercises?: Array<{
    description: string;
    example: string;
    expectedOutcome: string;
  }>;
  prevention?: {
    warningSigns: string[];
    mentalChecklist: string[];
    debuggingTips: string[];
  };
  connectionsToBiggerPicture?: {
    relatedConcepts: string[];
    realWorldRelevance: string;
    nextLearningSteps: string;
  };
  encouragement?: string;
  additionalResources?: string[];
  interactiveElements?: string[];
  codeExamples?: {
    wrongExample: string;
    correctExample: string;
    explanation: string;
  };
}

interface ExplanationResponse {
  ok: boolean;
  result: ExplanationResult;
  error?: string;
  raw?: string;
}

export default function TestTrainer() {
  // State management
  const [currentTest, setCurrentTest] = useState<TestResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [gradeResult, setGradeResult] = useState<GradeResponse['result'] | null>(null);
  const [explanations, setExplanations] = useState<Record<number, ExplanationResult>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [autoRegenerate, setAutoRegenerate] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(MAX_ATTEMPTS);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);

  // Load session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('testTrainerSession');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCurrentTest(data.currentTest);
        setAnswers(data.answers || {});
        setCurrentAttempt(data.currentAttempt || 0);
        setAutoRegenerate(data.autoRegenerate ?? true);
        setMaxAttempts(data.maxAttempts || MAX_ATTEMPTS);
      } catch (e) {
        console.error('Failed to load session:', e);
      }
    }
  }, []);

  // Save session to localStorage
  const saveSession = (data: any) => {
    localStorage.setItem('testTrainerSession', JSON.stringify(data));
  };

  // Generate new test
  const generateTest = async (focusTopics: string[] = []) => {
    setIsLoading(true);
    setGradeResult(null);
    setExplanations({});
    setAnswers({});
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: ['interview preparation', 'general knowledge'],
          numQuestions: 5,
          difficulty: 'medium',
          focusTopics
        })
      });

      const result = await response.json();
      setLastResponse(result);

      if (result.ok) {
        setCurrentTest(result);
        const newAttempt = focusTopics.length > 0 ? currentAttempt + 1 : 1;
        setCurrentAttempt(newAttempt);
        
        saveSession({
          currentTest: result,
          answers: {},
          currentAttempt: newAttempt,
          autoRegenerate,
          maxAttempts
        });
      } else {
        alert(`Failed to generate test: ${result.error}`);
      }
    } catch (error) {
      console.error('Generate test error:', error);
      alert('Failed to generate test. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit answers for grading
  const submitAnswers = async () => {
    if (!currentTest) return;
    
    setIsLoading(true);
    setExplanations({});
    
    try {
      const response = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: currentTest,
          answers
        })
      });

      const result = await response.json();
      setLastResponse(result);

      if (result.ok) {
        setGradeResult(result.result);
        
        // Check if we achieved target score
        if (result.result.totalScorePercent >= TARGET_PERCENT) {
          setSessionComplete(true);
          return;
        }

        // Get explanations for missed questions
        await getExplanationsForMissed(result.result.results);

        // Auto-regenerate if enabled and under max attempts
        if (autoRegenerate && currentAttempt < maxAttempts) {
          if (currentAttempt >= 3) {
            const confirm = window.confirm(
              `This will be attempt ${currentAttempt + 1} of ${maxAttempts}. Continue auto-regenerating?`
            );
            if (!confirm) {
              setAutoRegenerate(false);
              return;
            }
          }
          
          // Derive focus topics from missed questions
          const focusTopics = deriveFocusTopics(result.result.results);
          setTimeout(() => generateTest(focusTopics), 2000); // Short delay to show explanations
        }
      } else {
        alert(`Failed to grade test: ${result.error}`);
      }
    } catch (error) {
      console.error('Submit answers error:', error);
      alert('Failed to grade test. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Get explanations for missed questions
  const getExplanationsForMissed = async (results: GradeResult[]) => {
    const newExplanations: Record<number, ExplanationResult> = {};
    
    for (const result of results) {
      if (result.score < result.max) {
        try {
          const question = currentTest?.result.questions.find(q => q.id === result.id);
          const response = await fetch('/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question,
              studentAnswer: answers[result.id] || '',
              expectedAnswer: result.expected
            })
          });

          const explanationResult: ExplanationResponse = await response.json();
          if (explanationResult.ok) {
            newExplanations[result.id] = explanationResult.result;
          }
        } catch (error) {
          console.error('Failed to get explanation for question', result.id, error);
        }
      }
    }
    
    setExplanations(newExplanations);
  };

  // Derive focus topics from missed questions
  const deriveFocusTopics = (results: GradeResult[]): string[] => {
    const focusTopics: string[] = [];
    results.forEach(result => {
      if (result.score < result.max) {
        const question = currentTest?.result.questions.find(q => q.id === result.id);
        if (question) {
          // Simple heuristic: take first few words of the question
          const words = question.prompt.split(' ').slice(0, 3).join(' ');
          focusTopics.push(words);
        }
      }
    });
    return focusTopics;
  };

  // Handle answer change
  const handleAnswerChange = (questionId: number, value: string) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    
    saveSession({
      currentTest,
      answers: newAnswers,
      currentAttempt,
      autoRegenerate,
      maxAttempts
    });
  };

  // Reset session
  const resetSession = () => {
    setCurrentTest(null);
    setAnswers({});
    setGradeResult(null);
    setExplanations({});
    setCurrentAttempt(0);
    setSessionComplete(false);
    setLastResponse(null);
    localStorage.removeItem('testTrainerSession');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            GPT Interview Test Trainer
          </h1>
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4">
            <p className="font-semibold">Current Model: gpt-3.5-turbo</p>
            <p className="text-sm">Model might be imperfect — verify answers manually.</p>
          </div>
          
          {currentAttempt > 0 && (
            <p className="text-lg text-gray-600">
              Attempt {currentAttempt} of {maxAttempts}
              {gradeResult && (
                <span className="ml-2 font-semibold">
                  Last Score: {gradeResult.totalScorePercent.toFixed(1)}%
                </span>
              )}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Web Development Test Configuration</h2>
          
          {/* Topic Selection */}
          <div className="mb-6">
            <h3 className="font-medium mb-3">Topics (Junior Level Focus)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['HTML', 'CSS', 'JavaScript', 'APIs', 'React', 'Vue', 'DOM', 'Forms'].map(topic => (
                <label key={topic} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{topic}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Framework Selection */}
          <div className="mb-6">
            <label className="flex items-center gap-2">
              <span className="font-medium">Framework Focus:</span>
              <select className="px-3 py-2 border border-gray-300 rounded">
                <option value="vanilla">Vanilla JS/HTML/CSS</option>
                <option value="react">React</option>
                <option value="vue">Vue.js</option>
                <option value="angular">Angular</option>
                <option value="mixed">Mixed Frameworks</option>
              </select>
            </label>
          </div>

          {/* Difficulty Selection */}
          <div className="mb-6">
            <label className="flex items-center gap-2">
              <span className="font-medium">Difficulty:</span>
              <select 
                className="px-3 py-2 border border-gray-300 rounded"
                defaultValue="junior"
              >
                <option value="beginner">Beginner (0-6 months)</option>
                <option value="junior">Junior (6 months - 2 years)</option>
                <option value="intermediate">Intermediate (2+ years)</option>
              </select>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <button
              onClick={() => generateTest()}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium"
            >
              {isLoading ? 'Generating...' : currentTest ? 'Generate New Test' : 'Start Web Dev Test'}
            </button>
            
            <button
              onClick={resetSession}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium"
            >
              Reset Session
            </button>
          </div>

          {/* Session Settings */}
          <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-gray-200">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRegenerate}
                onChange={(e) => setAutoRegenerate(e.target.checked)}
                className="w-4 h-4"
              />
              <span>Auto-regenerate for missed topics</span>
            </label>
            
            <label className="flex items-center gap-2">
              <span>Max attempts:</span>
              <input
                type="number"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(parseInt(e.target.value) || MAX_ATTEMPTS)}
                min="1"
                max="10"
                className="w-16 px-2 py-1 border border-gray-300 rounded"
              />
            </label>

            <div className="text-sm text-gray-600">
              <strong>AI Agents Active:</strong> Test Generator • Code Checker • Learning Assistant
            </div>
          </div>
        </div>

        {/* Success Modal */}
        {sessionComplete && gradeResult && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-6 rounded-lg mb-6">
            <h2 className="text-xl font-bold mb-2">🎉 Congratulations!</h2>
            <p className="mb-2">
              You achieved {gradeResult.totalScorePercent.toFixed(1)}% in {currentAttempt} attempts!
            </p>
            <p>Earned {gradeResult.earnedPoints} out of {gradeResult.totalPoints} points.</p>
          </div>
        )}

        {/* Test Questions */}
        {currentTest && currentTest.result && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Test Questions</h2>
            
            {currentTest.result.questions.map((question) => {
              const result = gradeResult?.results.find(r => r.id === question.id);
              const explanation = explanations[question.id];
              
              return (
                <div key={question.id} className="mb-6 p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-lg">Question {question.id}</h3>
                    <span className="text-sm text-gray-600">{question.points} points</span>
                  </div>
                  
                  <p className="mb-4">{question.prompt}</p>
                  
                  {question.type === 'mcq' && question.choices ? (
                    <div className="space-y-2">
                      {question.choices.map((choice, index) => (
                        <label key={index} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={choice}
                            checked={answers[question.id] === choice}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            className="w-4 h-4"
                          />
                          <span>{choice}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={answers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      placeholder="Enter your answer..."
                      className="w-full p-3 border border-gray-300 rounded-lg resize-vertical"
                      rows={4}
                    />
                  )}
                  
                  {/* Show grade result */}
                  {result && (
                    <div className={`mt-4 p-3 rounded-lg ${result.correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{result.feedback}</span>
                        <span className="font-bold">{result.score}/{result.max}</span>
                      </div>
                      {!result.correct && (
                        <p className="text-sm mt-1">Expected: {result.expected}</p>
                      )}
                    </div>
                  )}
                  
                  {/* Show explanation for missed questions */}
                  {explanation && (
                    <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400">
                      <h4 className="font-semibold text-yellow-800">
                        🎯 AI Learning Assistant Explanation
                      </h4>
                      
                      {/* Encouragement */}
                      {explanation.encouragement && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                          <p className="text-blue-800 font-medium">💙 {explanation.encouragement}</p>
                        </div>
                      )}

                      {/* Basic explanation (fallback) */}
                      {explanation.brief && (
                        <p className="text-yellow-700 mb-2 font-medium">{explanation.brief}</p>
                      )}
                      {explanation.explanation && (
                        <p className="text-sm text-yellow-700 mb-2">{explanation.explanation}</p>
                      )}

                      {/* Enhanced step-by-step explanation */}
                      {explanation.stepByStepExplanation && (
                        <div className="mb-4">
                          <h5 className="font-medium text-yellow-800 mb-2">🔍 Step-by-Step Analysis:</h5>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-red-700">What went wrong:</span>
                              <p className="text-yellow-700">{explanation.stepByStepExplanation.whatWentWrong}</p>
                            </div>
                            <div>
                              <span className="font-medium text-orange-700">Why it's wrong:</span>
                              <p className="text-yellow-700">{explanation.stepByStepExplanation.whyItsWrong}</p>
                            </div>
                            <div>
                              <span className="font-medium text-green-700">Correct approach:</span>
                              <p className="text-yellow-700">{explanation.stepByStepExplanation.correctApproach}</p>
                            </div>
                            <div className="bg-yellow-100 p-2 rounded">
                              <span className="font-medium text-yellow-800">💡 Key insight:</span>
                              <p className="text-yellow-800">{explanation.stepByStepExplanation.keyInsight}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Code examples */}
                      {explanation.codeExamples && (
                        <div className="mb-4">
                          <h5 className="font-medium text-yellow-800 mb-2">💻 Code Examples:</h5>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs font-medium text-red-600 mb-1">❌ Your approach:</p>
                              <pre className="bg-red-50 p-2 rounded text-xs text-red-800 overflow-x-auto">
                                <code>{explanation.codeExamples.wrongExample}</code>
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-green-600 mb-1">✅ Correct approach:</p>
                              <pre className="bg-green-50 p-2 rounded text-xs text-green-800 overflow-x-auto">
                                <code>{explanation.codeExamples.correctExample}</code>
                              </pre>
                            </div>
                            <p className="text-xs text-yellow-700">{explanation.codeExamples.explanation}</p>
                          </div>
                        </div>
                      )}

                      {/* Prevention tips */}
                      {explanation.prevention && (
                        <div className="mb-4">
                          <h5 className="font-medium text-yellow-800 mb-2">🛡️ How to avoid this in the future:</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            {explanation.prevention.warningSigns && explanation.prevention.warningSigns.length > 0 && (
                              <div>
                                <p className="font-medium text-orange-700 mb-1">⚠️ Warning signs:</p>
                                <ul className="list-disc list-inside text-yellow-700 space-y-1">
                                  {explanation.prevention.warningSigns.map((sign, idx) => (
                                    <li key={idx} className="text-xs">{sign}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {explanation.prevention.mentalChecklist && explanation.prevention.mentalChecklist.length > 0 && (
                              <div>
                                <p className="font-medium text-blue-700 mb-1">🧠 Mental checklist:</p>
                                <ul className="list-disc list-inside text-yellow-700 space-y-1">
                                  {explanation.prevention.mentalChecklist.map((item, idx) => (
                                    <li key={idx} className="text-xs">{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {explanation.prevention.debuggingTips && explanation.prevention.debuggingTips.length > 0 && (
                              <div>
                                <p className="font-medium text-purple-700 mb-1">🔧 Debugging tips:</p>
                                <ul className="list-disc list-inside text-yellow-700 space-y-1">
                                  {explanation.prevention.debuggingTips.map((tip, idx) => (
                                    <li key={idx} className="text-xs">{tip}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Practice exercises */}
                      {explanation.practiceExercises && explanation.practiceExercises.length > 0 && (
                        <div className="mb-4">
                          <h5 className="font-medium text-yellow-800 mb-2">🏋️ Practice Exercises:</h5>
                          <div className="space-y-2">
                            {explanation.practiceExercises.slice(0, 2).map((exercise, idx) => (
                              <div key={idx} className="bg-yellow-100 p-3 rounded text-sm">
                                <p className="font-medium text-yellow-800">{exercise.description}</p>
                                <p className="text-yellow-700 mt-1">{exercise.example}</p>
                                <p className="text-xs text-yellow-600 mt-1">
                                  <em>Goal: {exercise.expectedOutcome}</em>
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fallback common mistakes */}
                      {explanation.commonMistakes && explanation.commonMistakes.length > 0 && (
                        <div className="mb-4">
                          <p className="font-medium text-yellow-800 mb-2">⚠️ Common mistakes:</p>
                          <ul className="list-disc list-inside text-yellow-700 space-y-1">
                            {explanation.commonMistakes.map((mistake, idx) => (
                              <li key={idx} className="text-sm">{mistake}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Correction */}
                      {explanation.correction && (
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <p className="text-sm text-green-800">
                            <strong>✅ Correction:</strong> {explanation.correction}
                          </p>
                        </div>
                      )}

                      {/* Additional resources */}
                      {explanation.additionalResources && explanation.additionalResources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-yellow-200">
                          <p className="font-medium text-yellow-800 mb-2">📚 Learn More:</p>
                          <div className="flex flex-wrap gap-2">
                            {explanation.additionalResources.slice(0, 3).map((resource, idx) => (
                              <a
                                key={idx}
                                href={resource}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
                              >
                                📖 Resource {idx + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            {currentTest && !gradeResult && (
              <button
                onClick={submitAnswers}
                disabled={isLoading || Object.keys(answers).length === 0}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg font-medium"
              >
                {isLoading ? 'Grading...' : 'Submit Answers'}
              </button>
            )}
          </div>
        )}

        {/* Debug: Last API Response */}
        {lastResponse && (
          <details className="bg-gray-100 rounded-lg p-4">
            <summary className="cursor-pointer font-medium text-gray-700">
              Last API Response (Debug)
            </summary>
            <pre className="mt-2 text-xs text-gray-600 overflow-auto">
              {JSON.stringify(lastResponse, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
