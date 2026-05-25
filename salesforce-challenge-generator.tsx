import React, { useState, useEffect } from 'react';
import { Plus, Download, Upload, Target, Clock, CheckCircle, Trash2, BookOpen, BarChart3 } from 'lucide-react';

const SalesforceAdminChallengeGenerator = () => {
  const [challenges, setChallenges] = useState([]);
  const [topicInput, setTopicInput] = useState('');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [challengeType, setChallengeType] = useState('hands-on');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('generator');
  const [showExportData, setShowExportData] = useState(false);

  const generateChallenge = async () => {
    if (!topicInput.trim()) {
      alert('Please enter a Salesforce topic');
      return;
    }

    setIsGenerating(true);
    
    try {
      let prompt;
      
      if (challengeType === 'hands-on') {
        prompt = `Generate a realistic, hands-on Salesforce Admin challenge for the topic: "${topicInput}" at ${difficulty} level.

Requirements:
- Create a practical scenario that an admin could actually build in Salesforce
- Include specific step-by-step tasks
- Make it appropriate for ${difficulty} level
- Focus on real-world business scenarios
- Include configuration details where relevant

Format your response as a JSON object with these exact fields:
{
  "title": "Challenge title (concise, descriptive)",
  "scenario": "Business scenario description",
  "tasks": ["Task 1", "Task 2", "Task 3", "etc."],
  "learningObjectives": ["Objective 1", "Objective 2", "etc."],
  "estimatedTime": "X hours/minutes"
}

Your entire response MUST be a single, valid JSON object. DO NOT include any text outside of the JSON structure, including backticks.`;
      } else {
        prompt = `Generate a multiple choice quiz for Salesforce Admin topic: "${topicInput}" at ${difficulty} level.

Requirements:
- Create 5-8 multiple choice questions
- Each question should have 4 options (A, B, C, D)
- Make questions appropriate for ${difficulty} level
- Focus on practical Salesforce Admin knowledge
- Include explanations for correct answers
- Cover different aspects of the topic

Format your response as a JSON object with these exact fields:
{
  "title": "Quiz title (concise, descriptive)",
  "description": "Brief description of what this quiz covers",
  "questions": [
    {
      "question": "Question text",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correctAnswer": "A",
      "explanation": "Explanation of why this is correct"
    }
  ],
  "learningObjectives": ["Objective 1", "Objective 2", "etc."],
  "estimatedTime": "X minutes"
}

Your entire response MUST be a single, valid JSON object. DO NOT include any text outside of the JSON structure, including backticks.`;
      }

      const response = await window.claude.complete(prompt);
      const challengeData = JSON.parse(response);
      
      const newChallenge = {
        id: Date.now(),
        topic: topicInput,
        difficulty: difficulty,
        type: challengeType,
        status: 'Not Started',
        notes: '',
        createdAt: new Date().toISOString(),
        isCustom: true,
        ...challengeData
      };

      setChallenges(prev => [newChallenge, ...prev]);
      setTopicInput('');
      
    } catch (error) {
      console.error('Failed to generate challenge:', error);
      alert('Failed to generate challenge. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateChallengeStatus = (id, newStatus) => {
    setChallenges(prev => 
      prev.map(challenge => 
        challenge.id === id ? { ...challenge, status: newStatus } : challenge
      )
    );
  };

  const updateChallengeNotes = (id, notes) => {
    setChallenges(prev => 
      prev.map(challenge => 
        challenge.id === id ? { ...challenge, notes } : challenge
      )
    );
  };

  const deleteChallenge = (id) => {
    if (window.confirm('Are you sure you want to delete this challenge?')) {
      setChallenges(prev => prev.filter(challenge => challenge.id !== id));
    }
  };

  const exportChallenges = () => {
    if (challenges.length === 0) {
      alert('No challenges to export!');
      return;
    }
    setShowExportData(true);
  };

  const importChallenges = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedChallenges = JSON.parse(e.target.result);
        if (Array.isArray(importedChallenges)) {
          setChallenges(prev => [...importedChallenges, ...prev]);
          alert(`Successfully imported ${importedChallenges.length} challenges!`);
        } else {
          alert('Invalid file format. Please select a valid JSON file.');
        }
      } catch (error) {
        alert('Failed to import challenges. Please check the file format.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Not Started': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'In Progress': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Completed': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStats = () => {
    const total = challenges.length;
    const notStarted = challenges.filter(c => c.status === 'Not Started').length;
    const inProgress = challenges.filter(c => c.status === 'In Progress').length;
    const completed = challenges.filter(c => c.status === 'Completed').length;
    
    return { total, notStarted, inProgress, completed };
  };

  const stats = getStats();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Salesforce Admin Challenge Generator</h1>
                <p className="text-gray-600">Generate hands-on challenges to master your Salesforce Admin skills</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={exportChallenges}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={challenges.length === 0}
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
              <label className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
                <Upload className="h-4 w-4" />
                <span>Import</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={importChallenges}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Challenges</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Not Started</p>
                <p className="text-2xl font-bold text-gray-700">{stats.notStarted}</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-gray-100"></div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('generator')}
                className={`py-4 border-b-2 font-medium text-sm ${
                  activeTab === 'generator'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Generate Challenge</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('challenges')}
                className={`py-4 border-b-2 font-medium text-sm ${
                  activeTab === 'challenges'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4" />
                  <span>My Challenges ({challenges.length})</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'generator' && (
              <div className="max-w-2xl">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate New Challenge</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Challenge Type
                    </label>
                    <select
                      value={challengeType}
                      onChange={(e) => setChallengeType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="hands-on">Hands-on Practice</option>
                      <option value="quiz">Multiple Choice Quiz</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Salesforce Topic
                    </label>
                    <input
                      type="text"
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      placeholder="e.g., Process Builder, Workflows, Data Import, User Management..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Difficulty Level
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>

                  <button
                    onClick={generateChallenge}
                    disabled={isGenerating || !topicInput.trim()}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGenerating ? `Generating ${challengeType === 'hands-on' ? 'Challenge' : 'Quiz'}...` : `Generate ${challengeType === 'hands-on' ? 'Challenge' : 'Quiz'}`}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'challenges' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Challenges</h2>
                
                {challenges.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No challenges yet. Generate your first challenge!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {challenges.map((challenge) => (
                      <div key={challenge.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              {challenge.isCustom && (
                                <div className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-medium flex items-center space-x-1">
                                  <Target className="h-3 w-3" />
                                  <span>Custom</span>
                                </div>
                              )}
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                challenge.type === 'quiz' ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600'
                              }`}>
                                {challenge.type === 'quiz' ? 'Quiz' : challenge.difficulty}
                              </span>
                              {challenge.type !== 'quiz' && (
                                <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded text-xs font-medium">
                                  {challenge.difficulty}
                                </span>
                              )}
                              <span className="text-gray-500 text-sm">
                                {challenge.topic}
                              </span>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              {challenge.title}
                            </h3>
                            <p className="text-gray-600 mb-3">
                              {challenge.scenario || challenge.description}
                            </p>
                            {challenge.estimatedTime && (
                              <p className="text-sm text-gray-500 mb-3">
                                Estimated time: {challenge.estimatedTime}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => deleteChallenge(challenge.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>

                        {challenge.tasks && (
                          <div className="mb-4">
                            <h4 className="font-medium text-gray-900 mb-2">Tasks:</h4>
                            <ul className="space-y-1">
                              {challenge.tasks.map((task, index) => (
                                <li key={index} className="text-gray-700 text-sm">
                                  • {task}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {challenge.questions && (
                          <div className="mb-4">
                            <h4 className="font-medium text-gray-900 mb-2">Questions:</h4>
                            <div className="space-y-4">
                              {challenge.questions.map((q, index) => (
                                <div key={index} className="bg-white p-4 rounded border">
                                  <p className="font-medium text-gray-900 mb-2">
                                    {index + 1}. {q.question}
                                  </p>
                                  <div className="space-y-1 mb-2">
                                    {q.options.map((option, optIndex) => (
                                      <p key={optIndex} className="text-sm text-gray-700">
                                        {option}
                                      </p>
                                    ))}
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium text-green-600">
                                      Correct: {q.correctAnswer}
                                    </span>
                                    <p className="text-gray-600 mt-1">
                                      {q.explanation}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {challenge.learningObjectives && (
                          <div className="mb-4">
                            <h4 className="font-medium text-gray-900 mb-2">Learning Objectives:</h4>
                            <ul className="space-y-1">
                              {challenge.learningObjectives.map((objective, index) => (
                                <li key={index} className="text-gray-700 text-sm">
                                  • {objective}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex space-x-2">
                            {['Not Started', 'In Progress', 'Completed'].map((status) => (
                              <button
                                key={status}
                                onClick={() => updateChallengeStatus(challenge.id, status)}
                                className={`px-3 py-1 rounded-full border text-sm font-medium transition-colors ${
                                  challenge.status === status 
                                    ? getStatusColor(status)
                                    : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes:
                          </label>
                          <textarea
                            value={challenge.notes}
                            onChange={(e) => updateChallengeNotes(challenge.id, e.target.value)}
                            placeholder="Add your implementation notes, learnings, or thoughts..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows="3"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export Data Modal */}
      {showExportData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Export Your Challenges</h3>
              <button
                onClick={() => setShowExportData(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Copy the JSON data below and save it to a file (e.g., "my-salesforce-challenges.json"). 
                You can later import this data back into the app.
              </p>
              <div className="relative">
                <textarea
                  value={JSON.stringify(challenges, null, 2)}
                  readOnly
                  className="w-full h-96 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm bg-gray-50"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(challenges, null, 2));
                    alert('Challenge data copied to clipboard!');
                  }}
                  className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  Copy to Clipboard
                </button>
              </div>
            </div>
            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={() => setShowExportData(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesforceAdminChallengeGenerator;