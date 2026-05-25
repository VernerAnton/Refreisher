import React, { useState, useEffect } from 'react';
import { BookOpen, Brain, Edit3, User, Clock, Star, Loader, CheckCircle, XCircle } from 'lucide-react';

const StudyRefresherApp = () => {
  const [activeMethod, setActiveMethod] = useState(null);
  const [studyData, setStudyData] = useState({
    flashcards: [],
    quizzes: [],
    brainDumps: [],
    explanations: []
  });
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState('');

  // Timer effect for brain dump
  useEffect(() => {
    let interval = null;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(timeLeft => timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
      alert('Time\'s up! Now let AI evaluate your brain dump.');
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    setTimeLeft(300);
    setTimerActive(true);
  };

  const resetTimer = () => {
    setTimerActive(false);
    setTimeLeft(300);
  };

  const generateFlashcards = async (subjects) => {
    setLoading(true);
    try {
      const prompt = `Generate 8 flashcards for studying: ${subjects}

Create a mix of definitions, concepts, and applications.

Respond with valid JSON only:
{
  "flashcards": [
    {
      "front": "Question or term",
      "back": "Answer or definition",
      "difficulty": "easy"
    }
  ]
}`;

      const response = await window.claude.complete(prompt);
      
      // Clean the response by removing markdown code blocks if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const data = JSON.parse(cleanResponse);
      
      if (!data.flashcards || !Array.isArray(data.flashcards)) {
        throw new Error('Invalid response format - no flashcards array found');
      }
      
      const flashcardsWithIds = data.flashcards.map(card => ({
        ...card,
        id: Date.now() + Math.random(),
        reviewed: false
      }));

      setStudyData(prev => ({
        ...prev,
        flashcards: flashcardsWithIds
      }));
    } catch (error) {
      console.error('Error generating flashcards:', error);
      alert('Error generating flashcards: ' + error.message + '\n\nPlease try again with a shorter subject description.');
    }
    setLoading(false);
  };

  const generateQuiz = async (subjects) => {
    console.log('generateQuiz called with subjects:', subjects);
    setLoading(true);
    try {
      const prompt = `Generate 5 quiz questions for studying: ${subjects}

Create a variety of question types. Make them challenging but fair.

Respond with valid JSON only:
{
  "questions": [
    {
      "question": "Question text here",
      "answer": "Correct answer with brief explanation",
      "type": "multiple-choice"
    }
  ]
}`;

      console.log('Calling window.claude.complete...');
      const response = await window.claude.complete(prompt);
      console.log('Got response:', response);
      
      // Clean the response by removing markdown code blocks if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('Cleaned response:', cleanResponse);
      const data = JSON.parse(cleanResponse);
      console.log('Parsed data:', data);
      
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error('Invalid response format - no questions array found');
      }
      
      const questionsWithIds = data.questions.map(q => ({
        ...q,
        id: Date.now() + Math.random(),
        userAnswer: '',
        evaluated: false,
        score: null
      }));

      console.log('Questions with IDs:', questionsWithIds);
      setStudyData(prev => ({
        ...prev,
        quizzes: questionsWithIds
      }));
      console.log('Quiz generated successfully!');
    } catch (error) {
      console.error('Error generating quiz:', error);
      alert('Error generating quiz: ' + error.message + '\n\nPlease try again with a shorter subject description.');
    }
    setLoading(false);
  };

  const evaluateAnswer = async (questionId, userAnswer, correctAnswer, question) => {
    if (!userAnswer.trim()) return;
    
    setLoading(true);
    try {
      const prompt = `Evaluate this student answer:

Question: ${question}
Correct Answer: ${correctAnswer}
Student Answer: ${userAnswer}

Rate the answer 0-100 and provide feedback.

Respond with valid JSON only:
{
  "score": 85,
  "feedback": "Brief feedback here",
  "isCorrect": true
}`;

      const response = await window.claude.complete(prompt);
      
      // Clean the response by removing markdown code blocks if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const evaluation = JSON.parse(cleanResponse);

      setStudyData(prev => ({
        ...prev,
        quizzes: prev.quizzes.map(q => 
          q.id === questionId 
            ? { ...q, evaluated: true, score: evaluation.score, feedback: evaluation.feedback, isCorrect: evaluation.isCorrect }
            : q
        )
      }));
    } catch (error) {
      console.error('Error evaluating answer:', error);
      alert('Error evaluating answer: ' + error.message);
    }
    setLoading(false);
  };

  const evaluateBrainDump = async (topic, content) => {
    setLoading(true);
    try {
      const prompt = `Evaluate this student's brain dump on ${topic}:

Student's Response: ${content}

Provide:
1. What key concepts they covered well
2. Important concepts they missed
3. Areas that need more study
4. Overall comprehension score (0-100)

Respond ONLY with valid JSON:
{
  "score": 75,
  "strengths": ["concept A", "concept B"],
  "missing": ["concept C", "concept D"], 
  "feedback": "Overall assessment and study recommendations",
  "studyTips": ["tip 1", "tip 2"]
}

DO NOT wrap in markdown code blocks.`;

      const response = await window.claude.complete(prompt);
      
      // Clean the response by removing markdown code blocks if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const evaluation = JSON.parse(cleanResponse);

      const newDump = {
        id: Date.now(),
        topic,
        content,
        timestamp: new Date().toLocaleString(),
        evaluation
      };

      setStudyData(prev => ({
        ...prev,
        brainDumps: [...prev.brainDumps, newDump]
      }));
    } catch (error) {
      console.error('Error evaluating brain dump:', error);
      alert('Error evaluating brain dump. Please try again.');
    }
    setLoading(false);
  };

  const evaluateExplanation = async (topic, explanation) => {
    setLoading(true);
    try {
      const prompt = `Evaluate how well this student explained ${topic}:

Student's Explanation: ${explanation}

Rate on:
- Clarity and simplicity 
- Accuracy of information
- Completeness of key concepts
- Use of examples/analogies

Respond ONLY with valid JSON:
{
  "clarityScore": 80,
  "accuracyScore": 90,
  "completenessScore": 70,
  "overallScore": 80,
  "feedback": "Good explanation but could improve...",
  "suggestions": ["Add more examples", "Clarify concept X"]
}

DO NOT wrap in markdown code blocks.`;

      const response = await window.claude.complete(prompt);
      
      // Clean the response by removing markdown code blocks if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const evaluation = JSON.parse(cleanResponse);

      const newExplanation = {
        id: Date.now(),
        topic,
        explanation,
        evaluation
      };

      setStudyData(prev => ({
        ...prev,
        explanations: [...prev.explanations, newExplanation]
      }));
    } catch (error) {
      console.error('Error evaluating explanation:', error);
      alert('Error evaluating explanation. Please try again.');
    }
    setLoading(false);
  };

  const FlashcardMethod = () => {
    const [currentCard, setCurrentCard] = useState(0);
    const [showBack, setShowBack] = useState(false);
    const [newSubjects, setNewSubjects] = useState('');

    const handleGenerate = async () => {
      console.log('Generate flashcards clicked, subjects:', newSubjects);
      if (newSubjects.trim()) {
        console.log('Calling generateFlashcards...');
        await generateFlashcards(newSubjects.trim());
        setNewSubjects('');
      } else {
        console.log('No subjects entered for flashcards');
      }
    };

    return (
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">AI-Generated Flashcards</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter subjects (e.g., 'Salesforce Validation Rules, Supply and Demand')"
              value={newSubjects}
              onChange={(e) => setNewSubjects(e.target.value)}
              className="flex-1 p-2 border rounded"
            />
            <button 
              onClick={handleGenerate} 
              disabled={loading || !newSubjects.trim()}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader className="animate-spin" size={16} />
                  <span>Generating...</span>
                </div>
              ) : (
                'Generate Flashcards'
              )}
            </button>
          </div>
        </div>

        {studyData.flashcards.length > 0 && (
          <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
            <div className="text-center mb-4">
              <span className="text-sm text-gray-500">
                Card {currentCard + 1} of {studyData.flashcards.length}
              </span>
            </div>
            <div className="min-h-32 bg-gray-50 p-4 rounded border-2 border-dashed border-gray-300 mb-4">
              {!showBack ? (
                <div>
                  <p className="text-lg font-medium">{studyData.flashcards[currentCard]?.front}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-2">{studyData.flashcards[currentCard]?.front}</p>
                  <p className="text-lg">{studyData.flashcards[currentCard]?.back}</p>
                  <span className={`inline-block mt-2 px-2 py-1 rounded text-xs ${
                    studyData.flashcards[currentCard]?.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                    studyData.flashcards[currentCard]?.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {studyData.flashcards[currentCard]?.difficulty}
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center">
              <button
                onClick={() => {
                  setCurrentCard(Math.max(0, currentCard - 1));
                  setShowBack(false);
                }}
                disabled={currentCard === 0}
                className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setShowBack(!showBack)}
                className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {showBack ? 'Hide Answer' : 'Show Answer'}
              </button>
              <button
                onClick={() => {
                  setCurrentCard(Math.min(studyData.flashcards.length - 1, currentCard + 1));
                  setShowBack(false);
                }}
                disabled={currentCard === studyData.flashcards.length - 1}
                className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const QuizMethod = () => {
    const [newSubjects, setNewSubjects] = useState('');

    const handleGenerate = async () => {
      console.log('Generate button clicked, subjects:', newSubjects);
      if (newSubjects.trim()) {
        console.log('Calling generateQuiz...');
        await generateQuiz(newSubjects.trim());
        setNewSubjects('');
      } else {
        console.log('No subjects entered');
      }
    };

    const handleAnswerChange = (questionId, answer) => {
      setStudyData(prev => ({
        ...prev,
        quizzes: prev.quizzes.map(q => 
          q.id === questionId ? { ...q, userAnswer: answer } : q
        )
      }));
    };

    return (
      <div className="space-y-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2">AI-Generated Quiz</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter subjects for quiz questions"
              value={newSubjects}
              onChange={(e) => setNewSubjects(e.target.value)}
              className="flex-1 p-2 border rounded"
            />
            <button 
              onClick={handleGenerate}
              disabled={loading || !newSubjects.trim()}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader className="animate-spin" size={16} />
                  <span>Generating...</span>
                </div>
              ) : (
                'Generate Quiz'
              )}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {studyData.quizzes.map((quiz, index) => (
            <div key={quiz.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="mb-3">
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">{quiz.type}</span>
                <h4 className="font-medium mt-2">Q{index + 1}: {quiz.question}</h4>
              </div>
              
              <textarea
                placeholder="Type your answer here..."
                value={quiz.userAnswer}
                onChange={(e) => handleAnswerChange(quiz.id, e.target.value)}
                className="w-full p-2 border rounded h-20 mb-3"
                disabled={quiz.evaluated}
              />
              
              {!quiz.evaluated ? (
                <button
                  onClick={() => evaluateAnswer(quiz.id, quiz.userAnswer, quiz.answer, quiz.question)}
                  disabled={loading || !quiz.userAnswer.trim()}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? <Loader className="animate-spin" size={16} /> : 'Submit Answer'}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {quiz.isCorrect ? <CheckCircle className="text-green-600" size={20} /> : <XCircle className="text-red-600" size={20} />}
                    <span className="font-medium">Score: {quiz.score}/100</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm font-medium text-gray-700 mb-1">Feedback:</p>
                    <p className="text-sm">{quiz.feedback}</p>
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-blue-600">Show Correct Answer</summary>
                    <p className="mt-2 p-2 bg-blue-50 rounded">{quiz.answer}</p>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const BrainDumpMethod = () => {
    const [topic, setTopic] = useState('');
    const [content, setContent] = useState('');

    const handleEvaluate = async () => {
      if (topic && content) {
        await evaluateBrainDump(topic, content);
        setTopic('');
        setContent('');
        resetTimer();
      }
    };

    return (
      <div className="space-y-4">
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="font-semibold text-purple-800 mb-2">AI-Evaluated Brain Dump</h3>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Topic (e.g., 'Salesforce Validation Rules')"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <div className="flex items-center gap-2 mb-2">
              <Clock size={20} className="text-purple-600" />
              <span className="text-lg font-mono">{formatTime(timeLeft)}</span>
              {!timerActive ? (
                <button onClick={startTimer} className="bg-purple-500 text-white px-3 py-1 rounded text-sm">
                  Start Timer
                </button>
              ) : (
                <button onClick={resetTimer} className="bg-red-500 text-white px-3 py-1 rounded text-sm">
                  Stop
                </button>
              )}
            </div>
            <textarea
              placeholder="Write everything you remember about this topic..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-2 border rounded h-32"
            />
            <button 
              onClick={handleEvaluate}
              disabled={loading || !topic || !content}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
            >
              {loading ? <Loader className="animate-spin" size={16} /> : 'Get AI Evaluation'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {studyData.brainDumps.map((dump) => (
            <div key={dump.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium mb-2">{dump.topic}</h4>
              <div className="text-xs text-gray-500 mb-3">{dump.timestamp}</div>
              
              {dump.evaluation && (
                <div className="bg-gray-50 p-4 rounded mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">Overall Score: {dump.evaluation.score}/100</span>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-green-700 mb-1">Strengths:</p>
                      <ul className="list-disc list-inside text-green-600">
                        {dump.evaluation.strengths?.map((strength, i) => (
                          <li key={i}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <p className="font-medium text-red-700 mb-1">Missing Concepts:</p>
                      <ul className="list-disc list-inside text-red-600">
                        {dump.evaluation.missing?.map((missing, i) => (
                          <li key={i}>{missing}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <p className="font-medium mb-1">Feedback:</p>
                    <p className="text-sm">{dump.evaluation.feedback}</p>
                  </div>
                  
                  {dump.evaluation.studyTips && (
                    <div className="mt-3">
                      <p className="font-medium mb-1">Study Tips:</p>
                      <ul className="list-disc list-inside text-sm">
                        {dump.evaluation.studyTips.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              <details className="text-sm">
                <summary className="cursor-pointer text-blue-600">Show Original Response</summary>
                <p className="mt-2 p-2 bg-gray-50 rounded whitespace-pre-wrap">{dump.content}</p>
              </details>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const ExplanationMethod = () => {
    const [topic, setTopic] = useState('');
    const [explanation, setExplanation] = useState('');

    const handleEvaluate = async () => {
      if (topic && explanation) {
        await evaluateExplanation(topic, explanation);
        setTopic('');
        setExplanation('');
      }
    };

    return (
      <div className="space-y-4">
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="font-semibold text-orange-800 mb-2">AI-Evaluated Feynman Technique</h3>
          <p className="text-sm text-orange-700 mb-3">Explain a concept simply and get AI feedback</p>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Topic to explain"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <textarea
              placeholder="Explain this topic in simple terms, as if teaching someone else..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="w-full p-2 border rounded h-32"
            />
            <button 
              onClick={handleEvaluate}
              disabled={loading || !topic || !explanation}
              className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50"
            >
              {loading ? <Loader className="animate-spin" size={16} /> : 'Get AI Feedback'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {studyData.explanations.map((exp) => (
            <div key={exp.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium mb-3">{exp.topic}</h4>
              
              {exp.evaluation && (
                <div className="bg-gray-50 p-4 rounded mb-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">{exp.evaluation.clarityScore}</div>
                      <div className="text-xs text-gray-600">Clarity</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">{exp.evaluation.accuracyScore}</div>
                      <div className="text-xs text-gray-600">Accuracy</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">{exp.evaluation.completenessScore}</div>
                      <div className="text-xs text-gray-600">Completeness</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-600">{exp.evaluation.overallScore}</div>
                      <div className="text-xs text-gray-600">Overall</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="font-medium">Feedback:</p>
                      <p>{exp.evaluation.feedback}</p>
                    </div>
                    
                    {exp.evaluation.suggestions && (
                      <div>
                        <p className="font-medium">Suggestions:</p>
                        <ul className="list-disc list-inside">
                          {exp.evaluation.suggestions.map((suggestion, i) => (
                            <li key={i}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <details className="text-sm">
                <summary className="cursor-pointer text-blue-600">Show Original Explanation</summary>
                <p className="mt-2 p-2 bg-gray-50 rounded whitespace-pre-wrap">{exp.explanation}</p>
              </details>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const methods = [
    {
      id: 'flashcards',
      name: 'AI Flashcards',
      icon: BookOpen,
      color: 'blue',
      description: 'Generate flashcards from your subjects',
      component: FlashcardMethod
    },
    {
      id: 'quiz',
      name: 'AI Quiz',
      icon: Brain,
      color: 'green',
      description: 'AI creates questions and evaluates answers',
      component: QuizMethod
    },
    {
      id: 'braindump',
      name: 'AI Brain Dump',
      icon: Edit3,
      color: 'purple',
      description: 'AI evaluates your memory recall',
      component: BrainDumpMethod
    },
    {
      id: 'explanation',
      name: 'AI Feynman',
      icon: User,
      color: 'orange',
      description: 'AI evaluates your explanations',
      component: ExplanationMethod
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">AI-Powered Study Refresher</h1>
        <p className="text-gray-600">AI generates content and evaluates your understanding of Economics and Salesforce Admin topics</p>
      </div>

      {!activeMethod ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {methods.map((method) => {
            const Icon = method.icon;
            const colorClasses = {
              blue: 'bg-blue-500 hover:bg-blue-600 border-blue-200',
              green: 'bg-green-500 hover:bg-green-600 border-green-200',
              purple: 'bg-purple-500 hover:bg-purple-600 border-purple-200',
              orange: 'bg-orange-500 hover:bg-orange-600 border-orange-200'
            };

            return (
              <div
                key={method.id}
                onClick={() => setActiveMethod(method)}
                className={`bg-white border-2 ${colorClasses[method.color]} rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg transform hover:-translate-y-1`}
              >
                <div className="flex items-center mb-3">
                  <Icon size={24} className={`text-${method.color}-600 mr-3`} />
                  <h3 className="text-lg font-semibold">{method.name}</h3>
                </div>
                <p className="text-gray-600 text-sm">{method.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {studyData[method.id]?.length || 0} items
                  </span>
                  <Star size={16} className="text-yellow-500" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <div className="flex items-center mb-6">
            <button
              onClick={() => setActiveMethod(null)}
              className="mr-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              ← Back to Methods
            </button>
            <h2 className="text-2xl font-bold">{activeMethod.name}</h2>
          </div>
          <activeMethod.component />
        </div>
      )}
    </div>
  );
};

export default StudyRefresherApp;