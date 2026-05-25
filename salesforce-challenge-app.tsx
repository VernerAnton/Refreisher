import React, { useState, useRef } from 'react';
import { CheckCircle, Clock, Circle, Star, RefreshCw, BookOpen, Trash2, Download, Upload, Copy, Check } from 'lucide-react';

const SalesforceChallengePlatform = () => {
  const [challenges, setChallenges] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('custom');
  const [customTopic, setCustomTopic] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [challengeType, setChallengeType] = useState('hands-on');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const fileInputRef = useRef(null);

  const topics = [
    'Data Management',
    'Security & Access',
    'Workflow Rules',
    'Process Builder',
    'Validation Rules',
    'Custom Objects & Fields',
    'Reports & Dashboards',
    'User Management',
    'Sharing Rules',
    'Email Templates',
    'Data Import/Export',
    'AppExchange',
    'Automation Tools',
    'Lightning Experience',
    'Mobile Administration'
  ];

  const challengeTemplates = {
    'Data Management': {
      beginner: [
        'Create a custom field on the Account object to track the company size (Small, Medium, Large)',
        'Set up a picklist field for Lead Status with 5 different values',
        'Create a lookup relationship between Contact and a custom Project object'
      ],
      intermediate: [
        'Design a data model for tracking customer support cases with proper relationships',
        'Set up duplicate rules to prevent duplicate Accounts based on website domain',
        'Create a master-detail relationship and configure rollup summary fields'
      ],
      advanced: [
        'Design a complete data architecture for a multi-division company with different products',
        'Implement a data governance strategy with field-level security and validation rules',
        'Create a complex data migration plan with staging objects and transformation rules'
      ]
    },
    'Security & Access': {
      beginner: [
        'Create a new profile for Sales Representatives with appropriate object permissions',
        'Set up a role hierarchy for a sales organization with 3 levels',
        'Configure field-level security to hide salary information from non-HR users'
      ],
      intermediate: [
        'Design sharing rules to allow regional managers to see all accounts in their region',
        'Set up permission sets for temporary project access across departments',
        'Configure organization-wide defaults and manual sharing for sensitive data'
      ],
      advanced: [
        'Implement a complex security model for a healthcare organization with HIPAA compliance',
        'Design territory management for a global sales organization',
        'Create a delegated administration setup for regional IT teams'
      ]
    },
    'Workflow Rules': {
      beginner: [
        'Create a workflow rule that sends an email when an Opportunity reaches Closed Won',
        'Set up a field update workflow to mark high-value leads as "Hot"',
        'Create a time-based workflow to follow up on leads after 3 days'
      ],
      intermediate: [
        'Design a workflow that escalates cases based on priority and age',
        'Create multiple workflows that work together for a complete lead nurturing process',
        'Set up workflows with complex criteria involving multiple objects'
      ],
      advanced: [
        'Build a complete opportunity management workflow system with multiple stages',
        'Design workflows that interact with external systems via outbound messages',
        'Create a complex approval process with multiple workflow triggers'
      ]
    },
    'Process Builder': {
      beginner: [
        'Create a process that creates a task when a new account is added',
        'Set up a process to update related contacts when account information changes',
        'Build a process that sends a notification when a case is escalated'
      ],
      intermediate: [
        'Design a process that creates records in multiple objects based on opportunity changes',
        'Set up a process with multiple criteria nodes for different scenarios',
        'Create a process that invokes a flow to handle complex business logic'
      ],
      advanced: [
        'Build a comprehensive lead-to-opportunity conversion process',
        'Design processes that handle bulk operations efficiently',
        'Create processes that integrate with external APIs via platform events'
      ]
    },
    'Validation Rules': {
      beginner: [
        'Create a validation rule to ensure phone numbers are entered in a specific format',
        'Set up validation to require a close date for opportunities in closed stages',
        'Build a rule that prevents backdating of opportunity close dates'
      ],
      intermediate: [
        'Design validation rules that work together to enforce complex business logic',
        'Create conditional validation based on record types or user profiles',
        'Set up validation rules that reference related object data'
      ],
      advanced: [
        'Build a comprehensive validation framework for data quality enforcement',
        'Create validation rules that handle complex date and currency calculations',
        'Design validation rules that work with approval processes and workflows'
      ]
    },
    'Custom Objects & Fields': {
      beginner: [
        'Create a custom object to track training sessions with basic fields',
        'Set up a custom object with different field types (text, number, date, picklist)',
        'Create a simple page layout for your custom object'
      ],
      intermediate: [
        'Design a custom object with lookup and master-detail relationships',
        'Set up record types for your custom object with different page layouts',
        'Create custom fields with dependent picklists and complex formulas'
      ],
      advanced: [
        'Build a complete custom application with multiple related objects',
        'Design objects with complex formula fields and rollup summaries',
        'Create a custom object hierarchy with multiple levels of relationships'
      ]
    },
    'Reports & Dashboards': {
      beginner: [
        'Create a tabular report showing all accounts created this month',
        'Build a summary report grouping opportunities by stage',
        'Create a simple dashboard with 3 components'
      ],
      intermediate: [
        'Design a matrix report showing sales performance by rep and month',
        'Create reports with custom formulas and bucket fields',
        'Build a dashboard for sales managers with drill-down capabilities'
      ],
      advanced: [
        'Create a comprehensive executive dashboard with multiple data sources',
        'Build reports that use cross filters and advanced grouping',
        'Design a reporting strategy for a multi-division organization'
      ]
    }
  };

  const generateChallenge = async () => {
    if (!customTopic.trim()) return;
    
    setIsGenerating(true);
    try {
      let prompt;
      
      if (challengeType === 'quiz') {
        prompt = `Create a Salesforce Administrator certification exam question about "${customTopic}" at ${difficulty} difficulty level.

        The question should be:
        - Multiple choice with 4 options (A, B, C, D)
        - Realistic and similar to actual certification exam questions
        - Appropriate for the ${difficulty} skill level
        - Focused on practical Salesforce admin knowledge
        - Include the correct answer at the end

        Format your response as:
        Question: [Your question here]
        
        A) [Option A]
        B) [Option B] 
        C) [Option C]
        D) [Option D]
        
        Correct Answer: [Letter and brief explanation]`;
      } else {
        prompt = `Create a realistic, hands-on Salesforce Administrator challenge for the topic "${customTopic}" at ${difficulty} difficulty level. 

        The challenge should be:
        - Practical and actionable (something they can actually build/configure in Salesforce)
        - Appropriate for the ${difficulty} skill level
        - Specific enough to be a clear task but open enough to allow creativity
        - Focused on real-world admin scenarios
        - One clear, focused challenge (not multiple tasks)

        Respond with just the challenge description, no extra text or formatting. Make it sound like a realistic work assignment.`;
      }

      const response = await window.claude.complete(prompt);
      const challengeDescription = response.trim();
      
      const newChallenge = {
        id: Date.now(),
        topic: customTopic,
        difficulty,
        type: challengeType,
        description: challengeDescription,
        status: 'not-started',
        createdDate: new Date().toLocaleDateString(),
        notes: ''
      };
      
      setChallenges([newChallenge, ...challenges]);
      setCustomTopic('');
    } catch (error) {
      console.error('Error generating challenge:', error);
      const fallback = challengeType === 'quiz' 
        ? `Multiple choice question: What is the primary purpose of ${customTopic} in Salesforce administration? (This is a fallback question - please try generating again)`
        : `Create a comprehensive ${difficulty}-level solution for ${customTopic} in Salesforce, including proper configuration, testing, and documentation.`;
      
      const newChallenge = {
        id: Date.now(),
        topic: customTopic,
        difficulty,
        type: challengeType,
        description: fallback,
        status: 'not-started',
        createdDate: new Date().toLocaleDateString(),
        notes: ''
      };
      
      setChallenges([newChallenge, ...challenges]);
      setCustomTopic('');
    }
    setIsGenerating(false);
  };

  const updateChallengeStatus = (id, newStatus) => {
    setChallenges(challenges.map(challenge => 
      challenge.id === id 
        ? { ...challenge, status: newStatus, completedDate: newStatus === 'completed' ? new Date().toLocaleDateString() : null }
        : challenge
    ));
  };

  const updateChallengeNotes = (id, notes) => {
    setChallenges(challenges.map(challenge => 
      challenge.id === id ? { ...challenge, notes } : challenge
    ));
  };

  const deleteChallenge = (id) => {
    setChallenges(challenges.filter(challenge => challenge.id !== id));
  };

  const exportChallenges = () => {
    const dataToExport = {
      challenges: challenges,
      exportDate: new Date().toISOString(),
      version: "1.0"
    };
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `salesforce-challenges-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const importChallenges = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // Validate the imported data
        if (importedData.challenges && Array.isArray(importedData.challenges)) {
          // Merge with existing challenges, avoiding duplicates by ID
          const existingIds = new Set(challenges.map(c => c.id));
          const newChallenges = importedData.challenges.filter(c => !existingIds.has(c.id));
          
          setChallenges([...challenges, ...newChallenges]);
          alert(`Successfully imported ${newChallenges.length} challenges!`);
        } else {
          alert('Invalid file format. Please select a valid challenge export file.');
        }
      } catch (error) {
        alert('Error reading file. Please make sure it\'s a valid JSON file.');
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const copyChallenge = async (id, content) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in-progress': return <Clock className="w-5 h-5 text-yellow-500" />;
      default: return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getDifficultyColor = (diff) => {
    switch (diff) {
      case 'beginner': return 'text-green-600 bg-green-100';
      case 'intermediate': return 'text-yellow-600 bg-yellow-100';
      case 'advanced': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };



  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center">
          <BookOpen className="w-8 h-8 mr-3 text-blue-600" />
          Salesforce Admin Challenge Platform
        </h1>
        <p className="text-gray-600">Generate hands-on challenges to master Salesforce administration skills</p>
        
        {/* Export/Import Controls */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={exportChallenges}
            disabled={challenges.length === 0}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Challenges
          </button>
          <button
            onClick={triggerImport}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Challenges
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={importChallenges}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Challenge Generator */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Create Study Material</h2>
        
        {/* Topic Input */}
        <div className="mb-4">
          <label className="block text-base font-semibold text-gray-800 mb-2">Salesforce Topic</label>
          <input
            type="text"
            placeholder="e.g., Territory Management, Process Builder, Data Security..."
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            className="w-full p-3 text-base border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Difficulty Level */}
        <div className="mb-4">
          <label className="block text-base font-semibold text-gray-800 mb-2">Difficulty Level</label>
          <select 
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full p-3 text-base border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        {/* Study Mode Selection */}
        <div className="mb-6">
          <label className="block text-base font-semibold text-gray-800 mb-2">Study Mode</label>
          <div className="grid grid-cols-2 gap-3">
            {/* Hands-on Challenge Card */}
            <button
              onClick={() => setChallengeType('hands-on')}
              className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                challengeType === 'hands-on' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center mb-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                  challengeType === 'hands-on' ? 'bg-blue-500' : 'bg-gray-400'
                }`}>
                  <RefreshCw className="w-3 h-3 text-white" />
                </div>
                <h3 className={`text-sm font-semibold ${
                  challengeType === 'hands-on' ? 'text-blue-600' : 'text-gray-800'
                }`}>
                  Hands-on Challenge
                </h3>
              </div>
              <p className="text-xs text-gray-600">
                Practical scenarios to complete in Salesforce
              </p>
            </button>

            {/* Knowledge Quiz Card */}
            <button
              onClick={() => setChallengeType('quiz')}
              className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                challengeType === 'quiz' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center mb-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                  challengeType === 'quiz' ? 'bg-blue-500' : 'bg-gray-400'
                }`}>
                  <BookOpen className="w-3 h-3 text-white" />
                </div>
                <h3 className={`text-sm font-semibold ${
                  challengeType === 'quiz' ? 'text-blue-600' : 'text-gray-800'
                }`}>
                  Knowledge Quiz
                </h3>
              </div>
              <p className="text-xs text-gray-600">
                5 multiple choice questions to test knowledge
              </p>
            </button>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateChallenge}
          disabled={!customTopic.trim() || isGenerating}
          className="w-full bg-blue-600 text-white text-base font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-200"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Generating...' : 'Generate Challenge'}
        </button>
      </div>

      {/* Challenges List */}
      <div className="space-y-4">
        {challenges.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <p className="text-gray-500 text-lg">No practice items yet. Generate your first challenge or quiz to get started!</p>
          </div>
        ) : (
          challenges.map(challenge => (
            <div key={challenge.id} className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium mr-3 ${getDifficultyColor(challenge.difficulty)}`}>
                      {challenge.difficulty.charAt(0).toUpperCase() + challenge.difficulty.slice(1)}
                    </span>
                    <span className="text-sm text-purple-600 font-medium">
                      {challenge.type === 'quiz' ? '❓' : '🔧'} {challenge.topic}
                    </span>
                    <button
                      onClick={() => copyChallenge(challenge.id, challenge.description)}
                      className="ml-auto px-3 py-1 rounded-md text-sm flex items-center bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      title="Copy challenge"
                    >
                      {copiedId === challenge.id ? (
                        <>
                          <Check className="w-4 h-4 mr-1 text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          Copy
                        </>
                      )}
                    </button>
                    <span className="text-sm text-gray-400 ml-2">Created: {challenge.createdDate}</span>
                  </div>
                  <div className="text-gray-800 text-lg mb-3 whitespace-pre-wrap">{challenge.description}</div>
                  <textarea
                    placeholder="Add notes about your implementation, learnings, or challenges..."
                    value={challenge.notes}
                    onChange={(e) => updateChallengeNotes(challenge.id, e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="2"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateChallengeStatus(challenge.id, 'not-started')}
                    className={`px-3 py-1 rounded-md text-sm flex items-center ${
                      challenge.status === 'not-started' ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Circle className="w-4 h-4 mr-1" />
                    Not Started
                  </button>
                  <button
                    onClick={() => updateChallengeStatus(challenge.id, 'in-progress')}
                    className={`px-3 py-1 rounded-md text-sm flex items-center ${
                      challenge.status === 'in-progress' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-100 text-gray-600 hover:bg-yellow-100'
                    }`}
                  >
                    <Clock className="w-4 h-4 mr-1" />
                    In Progress
                  </button>
                  <button
                    onClick={() => updateChallengeStatus(challenge.id, 'completed')}
                    className={`px-3 py-1 rounded-md text-sm flex items-center ${
                      challenge.status === 'completed' ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-600 hover:bg-green-100'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Completed
                  </button>
                  <button
                    onClick={() => deleteChallenge(challenge.id)}
                    className="px-3 py-1 rounded-md text-sm flex items-center bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                    title="Delete this challenge"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </button>
                </div>
                <div className="flex items-center">
                  {getStatusIcon(challenge.status)}
                  {challenge.completedDate && (
                    <span className="text-sm text-gray-500 ml-2">Completed: {challenge.completedDate}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SalesforceChallengePlatform;