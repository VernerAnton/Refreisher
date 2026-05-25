import React, { useState, useEffect } from 'react';
import { BookOpen, Brain, MessageSquare, User, Play, RotateCcw, ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react';

const EconomicsStudyApp = () => {
  const [currentView, setCurrentView] = useState('home');
  const [mode, setMode] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [sessionLength, setSessionLength] = useState(10);
  const [topic, setTopic] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [studyContent, setStudyContent] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  
  // Brain Dump state variables
  const [timeLimit, setTimeLimit] = useState(5);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [userResponse, setUserResponse] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState('');

  // Personas for Feynman technique
  const personas = [
    { id: 'child', name: '5-year-old child', description: 'Use very simple words, avoid any technical terms' },
    { id: 'teenager', name: 'High school student', description: 'Basic concepts okay, but keep it accessible' },
    { id: 'friend', name: 'College friend (non-economics)', description: 'Smart but not familiar with economics terminology' },
    { id: 'graduate', name: 'Graduate student', description: 'Understands complex concepts and some economics background' },
    { id: 'professor', name: 'Economics professor', description: 'Expert level - use precise terminology and deep analysis' }
  ];

  // Brain Dump feedback function
  const handleSubmitResponse = async () => {
    if (!userResponse.trim()) {
      alert('Please write something first!');
      return;
    }

    setIsGenerating(true);
    stopTimer();

    try {
      let prompt;
      
      if (mode === 'braindump') {
        prompt = `You are an economics tutor reviewing a student's brain dump about "${topic}". The student wrote everything they know about this topic in a timed session.

Here's what they wrote:
"${userResponse}"

Please provide comprehensive feedback covering:

1. **Strengths**: What concepts they understood well and explained correctly
2. **Key Concepts Covered**: List the main economics concepts they mentioned
3. **Missing Concepts**: Important aspects of "${topic}" they didn't mention
4. **Accuracy Check**: Point out any misconceptions or errors (be specific but encouraging)
5. **Depth Analysis**: Whether they showed surface-level or deep understanding
6. **Suggestions for Improvement**: Specific areas to study more and how to improve their understanding

Be encouraging but honest. Provide specific, actionable feedback to help them improve their understanding of ${topic}.`;
      } else if (mode === 'feynman') {
        const persona = personas.find(p => p.id === selectedPersona);
        prompt = `You are an economics tutor evaluating a student's attempt to explain "${topic}" to a ${persona.name}. 

The student's explanation:
"${userResponse}"

Context: They were trying to explain this to a ${persona.name} (${persona.description}).

Please provide detailed feedback covering:

1. **Audience Appropriateness**: Did they use language suitable for a ${persona.name}?
2. **Clarity**: Would the ${persona.name} actually understand this explanation?
3. **Completeness**: Did they cover the essential aspects of ${topic}?
4. **Use of Examples/Analogies**: How well did they use relatable examples?
5. **Jargon Check**: Did they avoid or properly explain technical terms?
6. **Strengths**: What they did really well
7. **Areas for Improvement**: Specific suggestions for better communication
8. **Suggested Analogies**: Better examples they could use for this audience

Be constructive and specific. Help them become better at explaining economics concepts clearly.`;
      }

      const feedbackResponse = await window.claude.complete(prompt);
      setFeedback(feedbackResponse);
      setShowFeedback(true);
    } catch (error) {
      console.error('Error getting feedback:', error);
      alert('Sorry, there was an error analyzing your response. Please try again!');
    } finally {
      setIsGenerating(false);
    }
  };

  // Timer functions for Brain Dump
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    setTimeRemaining(timeLimit * 60);
    setIsTimerActive(true);
  };

  const stopTimer = () => {
    setIsTimerActive(false);
  };

  const retryExercise = () => {
    setUserResponse('');
    setShowFeedback(false);
    setTimeRemaining(0);
    setIsTimerActive(false);
    // Keep persona selection for Feynman mode - user shouldn't have to reselect
  };

  // Timer effect for Brain Dump mode
  useEffect(() => {
    let interval = null;
    if (isTimerActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(time => time - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isTimerActive) {
      setIsTimerActive(false);
      if (mode === 'braindump') {
        handleSubmitResponse();
      }
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timeRemaining, mode]);

  const generateContent = async () => {
    if (!topic.trim()) {
      alert('Please enter a topic first!');
      return;
    }

    setIsGenerating(true);

    try {
      const prompt = mode === 'flashcards' 
        ? `You are an economics tutor creating study materials. Generate ${sessionLength} flashcards about "${topic}" at ${difficulty} difficulty level.

For flashcards, respond with ONLY a valid JSON array in this exact format:
[
  {
    "question": "Question or term here?",
    "answer": "Detailed answer or definition here"
  }
]

Make sure:
- Questions are appropriate for ${difficulty} level economics students
- Content is accurate and educational
- Answers are comprehensive but concise
- DO NOT include any text outside the JSON array
- DO NOT use markdown formatting or backticks

Generate the flashcard content now:`
        : `You are an economics tutor creating study materials. Generate ${sessionLength} multiple-choice quiz questions about "${topic}" at ${difficulty} difficulty level.

For quiz questions, respond with ONLY a valid JSON array in this exact format:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 1,
    "explanation": "Brief explanation of why this answer is correct"
  }
]

Make sure:
- Questions are appropriate for ${difficulty} level economics students
- Content is accurate and educational
- Each question has exactly 4 options and clear explanations
- DO NOT include any text outside the JSON array
- DO NOT use markdown formatting or backticks

Generate the quiz content now:`;

      const response = await window.claude.complete(prompt);
      const generatedContent = JSON.parse(response);
      
      setStudyContent(generatedContent);
      setCurrentIndex(0);
      setShowAnswer(false);
      setScore(0);
      setSelectedAnswer('');
      setShowResult(false);
      setCurrentView('study');
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Sorry, there was an error generating your study content. Please try again!');
    } finally {
      setIsGenerating(false);
    }
  };

  const nextCard = () => {
    if (currentIndex < studyContent.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      setSelectedAnswer('');
      setShowResult(false);
    } else {
      setCurrentView('complete');
    }
  };

  const handleQuizAnswer = (answerIndex) => {
    setSelectedAnswer(answerIndex);
    setShowResult(true);
    if (answerIndex === studyContent[currentIndex].correct) {
      setScore(score + 1);
    }
  };

  const restart = () => {
    setCurrentView('home');
    setMode('');
    setCurrentIndex(0);
    setShowAnswer(false);
    setStudyContent([]);
    setTopic('');
    setDifficulty('');
    setScore(0);
    setSelectedAnswer('');
    setShowResult(false);
    setUserResponse('');
    setFeedback('');
    setShowFeedback(false);
    setSelectedPersona('');
    setTimeRemaining(0);
    setIsTimerActive(false);
  };

  const backToModes = () => {
    setCurrentView('home');
    setMode('');
    setTopic('');
    setDifficulty('');
  };

  if (currentView === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">📚 Economics Study Hub</h1>
            <p className="text-white/90 text-lg">Choose your study method to master economics concepts!</p>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
            <div className="grid md:grid-cols-2 gap-6">
              <div 
                className="p-6 rounded-2xl cursor-pointer transition-all transform hover:scale-105 bg-gradient-to-r from-blue-100 to-cyan-100 hover:from-blue-200 hover:to-cyan-200 border-2 border-blue-200"
                onClick={() => {setMode('flashcards'); setCurrentView('setup');}}
              >
                <BookOpen className="w-8 h-8 mb-3 text-blue-600" />
                <h3 className="text-xl font-bold mb-2 text-blue-800">Flashcard Mode</h3>
                <p className="text-sm text-blue-700">Study with interactive flashcards. Perfect for memorizing key concepts and definitions.</p>
              </div>

              <div 
                className="p-6 rounded-2xl cursor-pointer transition-all transform hover:scale-105 bg-gradient-to-r from-green-100 to-emerald-100 hover:from-green-200 hover:to-emerald-200 border-2 border-green-200"
                onClick={() => {setMode('quiz'); setCurrentView('setup');}}
              >
                <Brain className="w-8 h-8 mb-3 text-green-600" />
                <h3 className="text-xl font-bold mb-2 text-green-800">Quiz Mode</h3>
                <p className="text-sm text-green-700">Test your knowledge with multiple-choice questions and instant feedback.</p>
              </div>

              <div 
                className="p-6 rounded-2xl cursor-pointer transition-all transform hover:scale-105 bg-gradient-to-r from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 border-2 border-purple-200"
                onClick={() => {setMode('braindump'); setCurrentView('setup');}}
              >
                <MessageSquare className="w-8 h-8 mb-3 text-purple-600" />
                <h3 className="text-xl font-bold mb-2 text-purple-800">Brain Dump Mode</h3>
                <p className="text-sm text-purple-700">Write everything you know about a topic, then get detailed feedback on your understanding.</p>
              </div>

              <div className="p-6 rounded-2xl cursor-pointer transition-all transform hover:scale-105 bg-gradient-to-r from-orange-100 to-red-100 hover:from-orange-200 hover:to-red-200 border-2 border-orange-200 opacity-75">
                <User className="w-8 h-8 mb-3 text-orange-600" />
                <h3 className="text-xl font-bold mb-2 text-orange-800">Feynman Technique</h3>
                <p className="text-sm text-orange-700">Explain concepts to different audiences. Master topics by teaching them simply.</p>
                <div className="text-xs text-orange-600 mt-2 font-semibold">Coming Soon!</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'setup') {
    // Split modes into two groups for cleaner code architecture
    const traditionalModes = ['flashcards', 'quiz'];
    const activeModes = ['braindump', 'feynman'];
    
    // Traditional Study Modes (Flashcards + Quiz)
    if (traditionalModes.includes(mode)) {
      const isFlashcards = mode === 'flashcards';
      const setupConfig = isFlashcards 
        ? {
            title: '📚 Flashcard Setup',
            subtitle: 'Configure your flashcard study session',
            bg: 'bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400',
            cardBg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
            buttonBg: 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700',
            focusColor: 'focus:border-blue-500 focus:ring-blue-200',
            icon: BookOpen,
            description: 'Study with AI-generated flashcards tailored to your topic and difficulty level.',
            buttonText: 'Generate Flashcards!',
            countLabel: 'Number of Cards:'
          }
        : {
            title: '🧠 Quiz Setup', 
            subtitle: 'Configure your quiz session',
            bg: 'bg-gradient-to-br from-green-400 via-emerald-400 to-teal-400',
            cardBg: 'bg-gradient-to-r from-green-500 to-emerald-500',
            buttonBg: 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700',
            focusColor: 'focus:border-green-500 focus:ring-green-200',
            icon: Brain,
            description: 'Test your knowledge with AI-generated multiple-choice questions and get instant feedback.',
            buttonText: 'Generate Quiz!',
            countLabel: 'Number of Questions:'
          };

      const IconComponent = setupConfig.icon;

      return (
        <div className={`min-h-screen ${setupConfig.bg} p-6`}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-2">{setupConfig.title}</h1>
              <p className="text-white/90 text-lg">{setupConfig.subtitle}</p>
            </div>

            <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
              <div className="mb-6">
                <button
                  onClick={backToModes}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Study Modes
                </button>
              </div>

              <div className="mb-8">
                <div className={`p-6 rounded-2xl ${setupConfig.cardBg} text-white`}>
                  <IconComponent className="w-8 h-8 mb-3" />
                  <h3 className="text-xl font-bold mb-2">{isFlashcards ? 'Flashcard Mode' : 'Quiz Mode'}</h3>
                  <p className="text-sm opacity-90">{setupConfig.description}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-gray-700 font-semibold mb-3">📖 Enter your economics topic:</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., supply and demand, market structures, macroeconomics..."
                    className={`w-full p-4 border-2 border-gray-200 rounded-xl ${setupConfig.focusColor} focus:ring-2 outline-none transition-all`}
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-3">🎯 Difficulty Level:</label>
                    <div className="space-y-2">
                      {['beginner', 'intermediate', 'advanced'].map((level) => (
                        <button
                          key={level}
                          onClick={() => setDifficulty(level)}
                          className={`w-full p-3 rounded-xl font-medium transition-all ${
                            difficulty === level
                              ? level === 'beginner' ? 'bg-yellow-500 text-white' 
                                : level === 'intermediate' ? 'bg-orange-500 text-white'
                                : 'bg-red-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-3">📄 {setupConfig.countLabel}</label>
                    <select
                      value={sessionLength}
                      onChange={(e) => setSessionLength(Number(e.target.value))}
                      className={`w-full p-3 border-2 border-gray-200 rounded-xl ${setupConfig.focusColor} outline-none`}
                    >
                      <option value={5}>{isFlashcards ? '5 cards' : '5 questions'}</option>
                      <option value={10}>{isFlashcards ? '10 cards' : '10 questions'}</option>
                      <option value={15}>{isFlashcards ? '15 cards' : '15 questions'}</option>
                      <option value={20}>{isFlashcards ? '20 cards' : '20 questions'}</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={generateContent}
                      disabled={!difficulty || !topic.trim() || isGenerating}
                      className={`w-full ${setupConfig.buttonBg} text-white p-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 flex items-center justify-center gap-2`}
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          {setupConfig.buttonText}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Active Learning Modes (Brain Dump + Feynman)
    if (activeModes.includes(mode)) {
      if (mode === 'braindump') {
        return (
          <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 p-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">🧠 Brain Dump Setup</h1>
                <p className="text-white/90 text-lg">Configure your brain dump session</p>
              </div>

              <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
                <div className="mb-6">
                  <button
                    onClick={backToModes}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Study Modes
                  </button>
                </div>

                <div className="mb-8">
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                    <MessageSquare className="w-8 h-8 mb-3" />
                    <h3 className="text-xl font-bold mb-2">Brain Dump Mode</h3>
                    <p className="text-sm opacity-90">Write everything you know about a topic in a timed session, then receive comprehensive AI feedback.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-3">📖 Enter your economics topic:</label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., supply and demand, market structures, macroeconomics..."
                      className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-3">⏰ Time Limit:</label>
                      <select
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(Number(e.target.value))}
                        className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                      >
                        <option value={2}>2 minutes</option>
                        <option value={5}>5 minutes</option>
                        <option value={10}>10 minutes</option>
                        <option value={15}>15 minutes</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() => setCurrentView('writing')}
                        disabled={!topic.trim()}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white p-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="w-5 h-5" />
                        Start Brain Dump!
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Feynman mode placeholder
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-2">🚧 Coming Soon!</h1>
              <p className="text-white/90 text-lg">{mode} mode is being built...</p>
            </div>
            
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl text-center">
              <button
                onClick={backToModes}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all flex items-center gap-2 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Study Modes
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  if (currentView === 'writing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">🧠 Brain Dump Mode</h2>
            <div className="text-white/90 text-lg">
              Write everything you know about: {topic}
            </div>
          </div>

          {!showFeedback ? (
            <div className="bg-white rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <Clock className="w-6 h-6 text-gray-600" />
                  <span className="text-gray-600 font-medium">
                    {isTimerActive ? `Time Remaining: ${formatTime(timeRemaining)}` : `Time Limit: ${timeLimit} minutes`}
                  </span>
                </div>
                {!isTimerActive && timeRemaining === 0 ? (
                  <button
                    onClick={startTimer}
                    className="bg-green-500 text-white px-6 py-2 rounded-xl font-semibold hover:bg-green-600 transition-all flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Start Timer
                  </button>
                ) : isTimerActive ? (
                  <button
                    onClick={stopTimer}
                    className="bg-red-500 text-white px-6 py-2 rounded-xl font-semibold hover:bg-red-600 transition-all"
                  >
                    Stop Timer
                  </button>
                ) : null}
              </div>

              {isTimerActive && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${(timeRemaining / (timeLimit * 60)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <textarea
                value={userResponse}
                onChange={(e) => setUserResponse(e.target.value)}
                placeholder="Start writing everything you know about this topic. Don't worry about organization - just get your thoughts down!"
                className="w-full h-96 p-4 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all resize-none text-lg"
                disabled={timeRemaining === 0 && isTimerActive}
              />

              <div className="flex justify-between mt-6">
                <button
                  onClick={() => setCurrentView('setup')}
                  className="bg-gray-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-all flex items-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back to Setup
                </button>

                <button
                  onClick={handleSubmitResponse}
                  disabled={!userResponse.trim() || isGenerating}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-pink-700 transition-all flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Getting Feedback...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Get Feedback
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 shadow-2xl">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">📊 Your Feedback</h3>
                <p className="text-gray-600">Here's how you did on your brain dump:</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-6 mb-6 max-h-96 overflow-y-auto">
                <div 
                  className="text-gray-800 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: feedback
                      // Remove standalone hashtags
                      .replace(/^#\s*$/gm, '')
                      // Format headers with more bottom margin
                      .replace(/^## (.*?)$/gm, '<h2 style="font-size: 1.25rem; font-weight: bold; margin: 0.75rem 0 0.5rem 0; color: #1f2937;">$1</h2>')
                      .replace(/^### (.*?)$/gm, '<h3 style="font-size: 1.125rem; font-weight: bold; margin: 0.5rem 0 0.4rem 0; color: #1f2937;">$1</h3>')
                      // Format numbered section headers (e.g., "1. **Strengths**")
                      .replace(/^(\d+)\.\s*\*\*(.*?)\*\*$/gm, '<h4 style="font-size: 1rem; font-weight: bold; margin: 0.5rem 0 0.3rem 0; color: #1f2937;">$1. $2</h4>')
                      // Format bold text with colons properly (e.g., "**Start with the basics**: explanation")
                      .replace(/\*\*(.*?)\*\*:\s*(.*?)$/gm, '<strong>$1:</strong> $2')
                      // Format regular bold text
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      // Format numbered lists with actual numbers (but not the main section headers)
                      .replace(/^(\d+)\.\s+(?!\*\*)(.*?)$/gm, '<li style="margin: 0.2rem 0; list-style-type: decimal; margin-left: 1.5rem;">$2</li>')
                      // Format bullet points with actual bullets
                      .replace(/^[-*]\s+(.*?)$/gm, '<li style="margin: 0.2rem 0; list-style-type: disc; margin-left: 1.5rem;">$1</li>')
                      // Wrap consecutive list items in ul/ol tags
                      .replace(/(<li.*?<\/li>)(\s*<li.*?<\/li>)*/g, (match) => {
                        if (match.includes('list-style-type: decimal')) {
                          return '<ol style="margin: 0.3rem 0; padding-left: 1.5rem;">' + match + '</ol>';
                        } else {
                          return '<ul style="margin: 0.3rem 0; padding-left: 1.5rem;">' + match + '</ul>';
                        }
                      })
                      // Format paragraphs with minimal spacing
                      .replace(/\n\s*\n/g, '</p><p style="margin: 0.2rem 0;">')
                      // Add opening paragraph tag
                      .replace(/^/, '<p style="margin: 0.2rem 0;">')
                      // Add closing paragraph tag
                      .replace(/$/, '</p>')
                      // Clean up empty paragraphs
                      .replace(/<p[^>]*>\s*<\/p>/g, '')
                  }}
                />
              </div>

              <div className="flex justify-between">
                <button
                  onClick={restart}
                  className="bg-gray-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  Back to Home
                </button>

                <button
                  onClick={retryExercise}
                  className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:from-green-700 hover:to-blue-700 transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentView === 'study') {
    if (mode === 'flashcards') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 p-6">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">📚 Flashcard Study Session</h2>
              <div className="text-white/90">Card {currentIndex + 1} of {studyContent.length}</div>
              <div className="w-full bg-white/30 rounded-full h-2 mt-3">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / studyContent.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <div 
              className="bg-white rounded-3xl p-8 shadow-2xl min-h-96 flex flex-col justify-center cursor-pointer transform transition-all hover:scale-105"
              onClick={() => setShowAnswer(!showAnswer)}
            >
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-4">
                  {showAnswer ? '💡 Answer' : '❓ Question'} - Click to flip
                </div>
                <div className="text-xl font-medium leading-relaxed">
                  {showAnswer ? studyContent[currentIndex]?.answer : studyContent[currentIndex]?.question}
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={restart}
                className="bg-gray-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-all flex items-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Back to Home
              </button>
              <button
                onClick={nextCard}
                className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 transition-all"
              >
                {currentIndex === studyContent.length - 1 ? 'Finish' : 'Next Card'} →
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (mode === 'quiz') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-400 via-blue-400 to-purple-400 p-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">🧠 Quiz Session</h2>
              <div className="text-white/90">Question {currentIndex + 1} of {studyContent.length} | Score: {score}/{currentIndex + (showResult ? 1 : 0)}</div>
              <div className="w-full bg-white/30 rounded-full h-2 mt-3">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / studyContent.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-2xl">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-4">{studyContent[currentIndex]?.question}</h3>
                <div className="space-y-3">
                  {studyContent[currentIndex]?.options?.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => !showResult && handleQuizAnswer(index)}
                      disabled={showResult}
                      className={`w-full p-4 rounded-xl text-left transition-all font-medium ${
                        showResult
                          ? index === studyContent[currentIndex].correct
                            ? 'bg-green-500 text-white'
                            : index === selectedAnswer && index !== studyContent[currentIndex].correct
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-100'
                          : 'bg-gray-100 hover:bg-gray-200 hover:scale-105'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm font-bold">
                          {String.fromCharCode(65 + index)}
                        </span>
                        {option}
                        {showResult && index === studyContent[currentIndex].correct && <CheckCircle className="w-5 h-5 ml-auto" />}
                        {showResult && index === selectedAnswer && index !== studyContent[currentIndex].correct && <XCircle className="w-5 h-5 ml-auto" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {showResult && (
                <div className={`p-4 rounded-xl mb-4 ${
                  selectedAnswer === studyContent[currentIndex].correct ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'
                } border-2`}>
                  <div className="font-semibold mb-2">
                    {selectedAnswer === studyContent[currentIndex].correct ? '✅ Correct!' : '❌ Incorrect'}
                  </div>
                  <div className="text-sm">{studyContent[currentIndex].explanation}</div>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={restart}
                  className="bg-gray-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  Back to Home
                </button>
                {showResult && (
                  <button
                    onClick={nextCard}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-600 transition-all"
                  >
                    {currentIndex === studyContent.length - 1 ? 'See Results' : 'Next Question'} →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  if (currentView === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold mb-4">Great Job!</h2>
            <p className="text-gray-600 mb-6">You've completed your {mode} session on {topic}!</p>
            
            <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl p-6 mb-6">
              {mode === 'quiz' ? (
                <>
                  <div className="text-2xl font-bold text-gray-800">Final Score</div>
                  <div className="text-4xl font-bold text-purple-600">{score}/{studyContent.length}</div>
                  <div className="text-gray-600">{Math.round((score / studyContent.length) * 100)}% Correct</div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-gray-800">Session Complete</div>
                  <div className="text-4xl font-bold text-purple-600">{studyContent.length}</div>
                  <div className="text-gray-600">Cards Reviewed</div>
                </>
              )}
            </div>

            <button
              onClick={restart}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 flex items-center gap-2 mx-auto"
            >
              <RotateCcw className="w-5 h-5" />
              Study More Topics
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default EconomicsStudyApp;