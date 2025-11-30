import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Calendar, 
  Phone, 
  BrainCircuit, 
  ListTodo, 
  Trash2, 
  User, 
  Bot, 
  Send, 
  Mic,
  Search,
  Zap,
  Users,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';
import { Agent, Message, StatsData } from './types';
import { AGENTS, INITIAL_STATS } from './constants';
import { createChatSession, sendMessageToAgent, connectLiveSession } from './services/geminiService';

const App: React.FC = () => {
  // State
  const [activeAgentId, setActiveAgentId] = useState<string>(AGENTS[0].id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [stats, setStats] = useState<StatsData>(INITIAL_STATS);
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<any>(null); // Store Gemini Chat Session
  
  // Voice Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveSessionRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Derived
  const activeAgent = AGENTS.find(a => a.id === activeAgentId) || AGENTS[0];

  // Initialize Chat Session when Agent Changes
  useEffect(() => {
    const initChat = async () => {
      // Clean up previous voice session if active
      if (isVoiceActive) {
        stopVoice();
      }

      chatSessionRef.current = await createChatSession(activeAgent.systemInstruction);
      
      // Reset messages on agent switch or load a welcome message
      setMessages([
        {
          id: 'welcome',
          role: 'ai',
          text: `Hello! I am your ${activeAgent.name}. ${activeAgent.greeting}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    };
    initChat();
  }, [activeAgentId, activeAgent]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const responseText = await sendMessageToAgent(chatSessionRef.current, inputText);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Update stats based on interaction (simulated)
      setStats(prev => ({
        ...prev,
        queries: prev.queries + 1,
        tasks: activeAgentId === 'task-manager' && inputText.toLowerCase().includes('create') ? prev.tasks + 1 : prev.tasks,
        events: activeAgentId === 'scheduler' && inputText.toLowerCase().includes('schedule') ? prev.events + 1 : prev.events,
        calls: activeAgentId === 'reception' && inputText.toLowerCase().includes('call') ? prev.calls + 1 : prev.calls,
      }));

    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'ai',
        text: "I'm sorry, I encountered an error processing your request. Please check your API key.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'ai',
      text: `Chat cleared. How can I help you with ${activeAgent.role} tasks?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  // --- Voice Handlers ---

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      setIsVoiceActive(true);

      const sessionPromise = connectLiveSession({
        onopen: () => {
           console.log("Voice session opened");
           const source = inputCtx.createMediaStreamSource(stream);
           const processor = inputCtx.createScriptProcessor(4096, 1, 1);
           
           processor.onaudioprocess = (e) => {
             const inputData = e.inputBuffer.getChannelData(0);
             const pcmData = createPcmData(inputData);
             sessionPromise.then(session => {
               session.sendRealtimeInput({ 
                 media: { 
                   mimeType: 'audio/pcm;rate=16000', 
                   data: pcmData 
                 } 
               });
             });
           };
           
           source.connect(processor);
           processor.connect(inputCtx.destination);
        },
        onmessage: async (msg: any) => {
           // Handle Audio Output
           const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
           if (base64Audio) {
             const ctx = outputAudioContextRef.current;
             if (!ctx) return;
             
             // Ensure continuous playback
             nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
             
             const audioBuffer = await decodeAudioData(decode(base64Audio), ctx);
             const source = ctx.createBufferSource();
             source.buffer = audioBuffer;
             source.connect(ctx.destination);
             
             source.onended = () => {
               audioSourcesRef.current.delete(source);
             };
             
             source.start(nextStartTimeRef.current);
             nextStartTimeRef.current += audioBuffer.duration;
             audioSourcesRef.current.add(source);
           }
           
           // Handle Interruption
           if (msg.serverContent?.interrupted) {
              audioSourcesRef.current.forEach(s => s.stop());
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
           }
        },
        onclose: () => {
          console.log("Voice session closed");
          stopVoice();
        },
        onerror: (e: any) => {
          console.error("Voice session error", e);
          stopVoice();
        }
      }, activeAgent.systemInstruction);
      
      liveSessionRef.current = sessionPromise;

    } catch (error) {
      console.error("Failed to start voice:", error);
      setIsVoiceActive(false);
    }
  };

  const stopVoice = async () => {
    setIsVoiceActive(false);
    
    // Stop Microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close Audio Contexts
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // Close Session
    if (liveSessionRef.current) {
      const session = await liveSessionRef.current;
      if (session) {
          session.close();
      }
      liveSessionRef.current = null;
    }
    
    // Stop Audio Playback
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const toggleVoice = () => {
    if (isVoiceActive) {
      stopVoice();
    } else {
      startVoice();
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800">
      
      {/* Header */}
      <header className="pt-8 pb-4 text-center px-4">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Search className="w-10 h-10 text-cyan-600" strokeWidth={2.5} />
          <h1 className="text-4xl font-bold text-cyan-700 tracking-tight">LogicLens AI</h1>
        </div>
        <p className="text-slate-500 text-lg mb-6">Multi-Agent Intelligence Platform</p>
        
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <Badge icon={<Mic size={14} />} text="Voice AI" color="bg-green-100 text-green-700" />
          <Badge icon={<Bot size={14} />} text="4 Agents" color="bg-blue-100 text-blue-700" />
          <Badge icon={<Zap size={14} />} text="Real-time" color="bg-amber-100 text-amber-700" />
          <Badge icon={<ShieldCheck size={14} />} text="Enterprise" color="bg-purple-100 text-purple-700" />
        </div>

        {/* Stats Row */}
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
          <StatCard 
            icon={<CheckCircle2 size={32} />} 
            value={stats.tasks} 
            label="Tasks" 
            color="text-emerald-500" 
            bgColor="bg-emerald-50" 
            borderColor="border-emerald-100"
          />
          <StatCard 
            icon={<Calendar size={32} />} 
            value={stats.events} 
            label="Events" 
            color="text-blue-500" 
            bgColor="bg-blue-50"
            borderColor="border-blue-100"
          />
          <StatCard 
            icon={<Phone size={32} />} 
            value={stats.calls} 
            label="Calls" 
            color="text-amber-500" 
            bgColor="bg-amber-50"
            borderColor="border-amber-100"
          />
          <StatCard 
            icon={<BrainCircuit size={32} />} 
            value={stats.queries} 
            label="Queries" 
            color="text-purple-500" 
            bgColor="bg-purple-50"
            borderColor="border-purple-100"
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 flex flex-col md:flex-row gap-6 mb-10">
        
        {/* Mobile Menu Toggle */}
        <div className="md:hidden flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-4">
          <span className="font-semibold text-slate-700">Select Agent</span>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Sidebar / Left Panel */}
        <aside className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block w-full md:w-80 flex-shrink-0 space-y-6`}>
          
          {/* Agent Selector */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="text-purple-600" />
              <h2 className="text-xl font-bold text-slate-800">AI Agents</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">Choose your assistant</p>
            
            <div className="space-y-3">
              {AGENTS.map((agent) => (
                <AgentCard 
                  key={agent.id}
                  agent={agent}
                  isActive={activeAgentId === agent.id}
                  onClick={() => {
                    setActiveAgentId(agent.id);
                    setMobileMenuOpen(false);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Voice Assistant Module */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Mic className="text-slate-600" />
              <h2 className="text-lg font-bold text-slate-800">Voice Assistant</h2>
            </div>
            
            <button 
              onClick={toggleVoice}
              className={`w-full py-4 rounded-lg flex items-center justify-center gap-2 font-semibold text-white transition-all duration-300 ${isVoiceActive ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-emerald-400 hover:bg-emerald-500 shadow-emerald-200'} shadow-lg`}
            >
              <Mic className={isVoiceActive ? 'animate-pulse' : ''} />
              {isVoiceActive ? 'Stop Voice' : 'Start Voice'}
            </button>
            {isVoiceActive && (
              <div className="mt-3 text-center text-xs text-slate-500 animate-pulse">
                Listening to you...
              </div>
            )}
          </div>
        </aside>

        {/* Chat Interface / Right Panel */}
        <section className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden h-[600px] md:h-auto">
          
          {/* Chat Header */}
          <div className={`p-4 border-b border-slate-100 flex justify-between items-center ${activeAgent.bgColor} bg-opacity-30`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeAgent.color} bg-white`}>
                {activeAgent.icon}
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-800">{activeAgent.name}</h2>
                <p className="text-xs text-slate-500">{activeAgent.description}</p>
              </div>
            </div>
            <button onClick={clearChat} className="text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} agentColor={activeAgent.bgColor} />
            ))}
            {isTyping && (
              <div className="flex justify-start">
                 <div className="bg-slate-200 rounded-2xl rounded-tl-none py-3 px-4 flex items-center gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                 </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="relative">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask ${activeAgent.name}...`}
                className="w-full border border-slate-200 rounded-xl py-4 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-700 bg-white shadow-sm"
              />
              <button 
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isTyping}
                className={`absolute right-2 top-2 p-2 rounded-lg transition-colors ${inputText.trim() ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-slate-100 text-slate-400'}`}
              >
                <Send size={20} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 ml-1">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>

        </section>
      </main>
      
      <footer className="text-center py-6 text-slate-400 text-sm">
        <div className="flex items-center justify-center gap-2">
            <span className="bg-slate-800 text-white px-2 py-1 rounded text-xs font-mono">Made with Gemini</span>
        </div>
      </footer>
    </div>
  );
};

// --- Subcomponents ---

const Badge: React.FC<{ icon: React.ReactNode, text: string, color: string }> = ({ icon, text, color }) => (
  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-sm ${color}`}>
    {icon}
    <span>{text}</span>
  </div>
);

const StatCard = ({ icon, value, label, color, bgColor, borderColor }: any) => (
  <div className={`p-6 rounded-2xl bg-white border ${borderColor} shadow-sm hover:shadow-md transition-shadow flex flex-col items-center justify-center gap-2 relative overflow-hidden group`}>
    <div className={`absolute top-0 w-full h-1 ${bgColor.replace('bg-', 'bg-opacity-50 ')}`}></div>
    <div className={`mb-2 ${color}`}>
      {icon}
    </div>
    <span className={`text-4xl font-bold ${color}`}>{value}</span>
    <span className="text-slate-500 font-medium text-sm">{label}</span>
  </div>
);

const AgentCard: React.FC<{ agent: Agent, isActive: boolean, onClick: () => void }> = ({ agent, isActive, onClick }) => (
  <div 
    onClick={onClick}
    className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 flex items-start gap-3 group
      ${isActive 
        ? `bg-cyan-50/50 border-cyan-200 shadow-sm ring-1 ring-cyan-100` 
        : 'bg-slate-50 border-transparent hover:bg-white hover:shadow-sm hover:border-slate-200'
      }`}
  >
    <div className={`p-2.5 rounded-lg text-white shadow-sm transition-transform group-hover:scale-105 ${
      isActive ? 'bg-cyan-500' : 
      agent.id === 'scheduler' ? 'bg-blue-400' :
      agent.id === 'reception' ? 'bg-orange-400' :
      agent.id === 'knowledge' ? 'bg-purple-400' : 'bg-cyan-400'
    }`}>
      {agent.icon}
    </div>
    <div className="flex-1">
      <div className="flex justify-between items-center">
        <h3 className={`font-bold ${isActive ? 'text-cyan-900' : 'text-slate-700'}`}>{agent.name}</h3>
        {isActive && <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-medium">Active</span>}
      </div>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{agent.description}</p>
    </div>
  </div>
);

const ChatMessage: React.FC<{ message: Message, agentColor: string }> = ({ message, agentColor }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm
          ${isUser ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'}
        `}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        {/* Bubble */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div className="flex items-center gap-2 mb-1 px-1">
             <span className="text-xs font-bold text-slate-700">
               {isUser ? 'You' : 'Task Manager'}
             </span>
             <span className="text-[10px] text-slate-400">{message.timestamp}</span>
          </div>
          
          <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap
            ${isUser 
              ? 'bg-amber-100 text-slate-800 rounded-tr-none' 
              : 'bg-slate-200 text-slate-800 rounded-tl-none'
            }
          `}>
            {message.text}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Audio Helpers ---

function createPcmData(data: Float32Array): string {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return encode(new Uint8Array(int16.buffer));
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
   const sampleRate = 24000;
   const numChannels = 1;
   const dataInt16 = new Int16Array(data.buffer);
   const frameCount = dataInt16.length / numChannels;
   const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
   
   const channelData = buffer.getChannelData(0);
   for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
   }
   return buffer;
}

export default App;
