import React, { useState, useRef, useEffect } from 'react';
import { Camera, AlertTriangle, FileText, MessageCircle, Volume2, Loader2, Pill } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Utility to remove Markdown symbols so the TTS doesn't read them aloud
const cleanTextForSpeech = (text) => {
  return text.replace(/[#*`~>-]/g, '').replace(/\n/g, ' ').trim();
};

const API_BASE = 'https://mediscan-ai-1-6xod.onrender.com';

export default function App() {
  const [activeTab, setActiveTab] = useState('scan');
  
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <Pill size={32} />
          <h1 className="text-2xl font-bold">MediScan AI</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto mt-8 p-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-lg shadow-sm">
          <TabButton icon={<Camera />} label="Scan Tablet" isActive={activeTab === 'scan'} onClick={() => setActiveTab('scan')} />
          <TabButton icon={<AlertTriangle />} label="Check Interactions" isActive={activeTab === 'safety'} onClick={() => setActiveTab('safety')} />
          <TabButton icon={<FileText />} label="Read Prescription" isActive={activeTab === 'ocr'} onClick={() => setActiveTab('ocr')} />
          <TabButton icon={<MessageCircle />} label="AI Chat" isActive={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
        </div>

        {/* Tab Content Panels */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          {activeTab === 'scan' && <ScannerModule endpoint="/recognize-medicine" title="Tablet Recognition" />}
          {activeTab === 'ocr' && <ScannerModule endpoint="/read-prescription" title="Prescription Reader" />}
          {activeTab === 'safety' && <InteractionModule />}
          {activeTab === 'chat' && <ChatModule />}
        </div>
      </main>
    </div>
  );
}

// --- Components ---

function TabButton({ icon, label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
        isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ScannerModule({ endpoint, title }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResult(null);
    }
  };

  const handleScan = async () => {
    if (!file) return;
    setLoading(true);
    
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setResult(data.data);
    } catch (error) {
      console.error("Scan error:", error);
      setResult("Error processing the image. Please ensure the backend is running.");
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      
      <div 
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => fileInputRef.current.click()}
      >
        {preview ? (
          <img src={preview} alt="Preview" className="mx-auto max-h-64 rounded-md shadow-sm" />
        ) : (
          <div className="text-gray-500 flex flex-col items-center">
            <Camera size={48} className="mb-2 text-gray-400" />
            <p>Click to upload or take a photo</p>
          </div>
        )}
      </div>
      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

      <button 
        onClick={handleScan} 
        disabled={!file || loading}
        className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 flex justify-center items-center gap-2"
      >
        {loading && <Loader2 className="animate-spin" />}
        {loading ? 'Analyzing with AI...' : 'Scan & Analyze'}
      </button>

      {result && <ResultDisplay result={result} />}
    </div>
  );
}

function InteractionModule() {
  const [medicines, setMedicines] = useState(['', '']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleAddMedicine = () => setMedicines([...medicines, '']);
  
  const handleMedicineChange = (index, value) => {
    const updated = [...medicines];
    updated[index] = value;
    setMedicines(updated);
  };

  const handleCheck = async () => {
    const validMeds = medicines.filter(m => m.trim() !== '');
    if (validMeds.length < 2) return alert("Enter at least two medicines.");
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/check-interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicines: validMeds }),
      });
      const data = await response.json();
      setResult(data.data);
    } catch (error) {
      setResult("Error checking interactions.");
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Drug Interaction Checker</h2>
      <p className="text-gray-600 mb-4">Enter multiple medicines to check if they are safe to take together.</p>
      
      <div className="space-y-3 mb-4">
        {medicines.map((med, idx) => (
          <input
            key={idx}
            type="text"
            value={med}
            onChange={(e) => handleMedicineChange(idx, e.target.value)}
            placeholder={`Medicine ${idx + 1}`}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        ))}
      </div>
      
      <div className="flex gap-2">
        <button onClick={handleAddMedicine} className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium">
          + Add Another
        </button>
        <button 
          onClick={handleCheck} 
          disabled={loading}
          className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 flex justify-center items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Check Safety'}
        </button>
      </div>

      {result && <ResultDisplay result={result} />}
    </div>
  );
}

function ChatModule() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, context: "Patient wants general advice or follow up on previous scans." }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', text: data.data }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I couldn't reach the server." }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[600px]">
      <h2 className="text-xl font-bold mb-4">MediScan AI Assistant</h2>
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200 space-y-4">
        {messages.length === 0 && <p className="text-gray-400 text-center mt-20">Ask a question about your dosage, timing, or side effects.</p>}
        
        {messages.map((m, idx) => (
          <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            {m.role === 'user' ? (
              <div className="bg-blue-600 text-white p-3 rounded-lg max-w-[80%]">
                {m.text}
              </div>
            ) : (
              // Use ResultDisplay for AI messages to give them full Markdown, TTS, and Translation powers!
              <div className="w-full max-w-[90%]">
                <ResultDisplay result={m.text} />
              </div>
            )}
          </div>
        ))}
        {loading && <Loader2 className="animate-spin text-blue-600 my-4 ml-4" />}
      </div>
      <div className="flex gap-2">
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="E.g., What if I miss a dose?" 
          className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button onClick={handleSend} disabled={loading} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700">
          Send
        </button>
      </div>
    </div>
  );
}

// Shared Result Component with Translation & Voice
// Shared Result Component with Translation, Voice & Markdown
function ResultDisplay({ result }) {
  const [displayResult, setDisplayResult] = useState(result);
  const [translating, setTranslating] = useState(false);
  const [currentLang, setCurrentLang] = useState('English'); 
  const [loadingAudio, setLoadingAudio] = useState(false);

  useEffect(() => { 
    setDisplayResult(result); 
    setCurrentLang('English'); 
  }, [result]);

  const handleTranslate = async (lang) => {
    if (lang === 'English') {
      setDisplayResult(result);
      setCurrentLang('English');
      return;
    }

    setTranslating(true);
    setCurrentLang(lang);
    try {
      const response = await fetch(`${API_BASE}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: result, target_language: lang }),
      });
      const data = await response.json();
      setDisplayResult(data.data);
    } catch (error) {
      setDisplayResult("Translation failed. Please try again.");
    }
    setTranslating(false);
  };

  const handleVoice = async () => {
    setLoadingAudio(true);
    try {
      // Strip markdown symbols before sending to TTS
      const cleanText = cleanTextForSpeech(displayResult);
      
      const response = await fetch(`${API_BASE}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, language: currentLang })
      });

      if (!response.ok) throw new Error("Failed to generate audio");

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (error) {
      alert("Failed to fetch audio from the server.");
    }
    setLoadingAudio(false);
  };

  return (
    <div className="mt-6 bg-gray-50 rounded-lg p-5 border border-gray-200">
      <div className="flex flex-wrap justify-between items-center mb-4 border-b pb-2 gap-2">
        <h3 className="font-bold text-gray-800">AI Analysis</h3>
        
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => handleTranslate('English')} className={`font-medium ${currentLang === 'English' ? 'text-blue-600 underline' : 'text-gray-600 hover:text-blue-600'}`}>English</button>
          <button onClick={() => handleTranslate('Hindi')} disabled={translating} className={`font-medium ${currentLang === 'Hindi' ? 'text-blue-600 underline' : 'text-gray-600 hover:text-blue-600'}`}>Hindi</button>
          <button onClick={() => handleTranslate('Marathi')} disabled={translating} className={`font-medium ${currentLang === 'Marathi' ? 'text-blue-600 underline' : 'text-gray-600 hover:text-blue-600'}`}>Marathi</button>
          <div className="w-px h-5 bg-gray-300 mx-1"></div>
          <button onClick={handleVoice} disabled={loadingAudio || translating} className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-full hover:bg-green-200 transition-colors disabled:opacity-50">
            {loadingAudio ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
            <span className="font-bold">{loadingAudio ? 'Loading...' : 'Play'}</span>
          </button>
        </div>
      </div>
      
      {/* ReactMarkdown handles the visual formatting */}
      <div className="prose prose-sm max-w-none text-gray-800">
        {translating ? (
          <div className="flex flex-col items-center justify-center py-6 text-blue-600">
            <Loader2 className="animate-spin mb-2" size={32} />
            <p className="text-sm font-medium animate-pulse">Translating to {currentLang}...</p>
          </div>
        ) : (
          <ReactMarkdown>{displayResult}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}
