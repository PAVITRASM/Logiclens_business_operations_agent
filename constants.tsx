import React from 'react';
import { ListTodo, Calendar, Phone, BrainCircuit } from 'lucide-react';
import { Agent, StatsData } from './types';

export const INITIAL_STATS: StatsData = {
  tasks: 2,
  events: 1,
  calls: 1,
  queries: 1,
  completed: 0
};

export const AGENTS: Agent[] = [
  {
    id: 'task-manager',
    name: 'Task Manager',
    role: 'Project Manager',
    description: 'Create, track & complete tasks',
    icon: <ListTodo size={20} />,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
    greeting: "I can help you create, track, and update your tasks. What's on your list today?",
    systemInstruction: `You are an efficient Task Manager AI. 
    Your goal is to help the user organize their work. 
    When the user asks to create a task, format your response nicely with emojis like:
    
    Task Created Successfully!
    📝 **Title**: [Task Title]
    🆔 **ID**: [Random Hex]
    ⏰ **Created**: [Current Time]
    📊 **Status**: 🟡 Pending
    
    Always be concise, professional, and structured.`
  },
  {
    id: 'scheduler',
    name: 'Smart Scheduler',
    role: 'Executive Assistant',
    description: 'Schedule meetings & appointments',
    icon: <Calendar size={20} />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    greeting: "Need to book a meeting or check your calendar? Just let me know.",
    systemInstruction: `You are a Smart Scheduler AI.
    Your goal is to manage the user's calendar.
    When asked to schedule a meeting, confirm the details (Time, Participants, Topic).
    Format your confirmation like:
    
    📅 **Meeting Scheduled**
    Topic: [Topic]
    Time: [Time]
    
    Be polite and time-conscious.`
  },
  {
    id: 'reception',
    name: 'Reception Agent',
    role: 'Front Desk',
    description: '24/7 professional call handling',
    icon: <Phone size={20} />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    greeting: "I'm handling incoming calls and inquiries. How can I assist you right now?",
    systemInstruction: `You are a Receptionist AI.
    You handle incoming queries, take messages, and route calls.
    Your tone should be warm, welcoming, and very professional.
    Summarize calls like:
    
    📞 **Call Logged**
    Caller: [Name/Unknown]
    Message: [Summary]
    Action Required: [Yes/No]`
  },
  {
    id: 'knowledge',
    name: 'Knowledge Base',
    role: 'Researcher',
    description: 'Instant answers to any question',
    icon: <BrainCircuit size={20} />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    greeting: "I have access to the company knowledge base. Ask me anything.",
    systemInstruction: `You are a Knowledge Base AI.
    You answer questions based on general business knowledge and provided context.
    Provide clear, direct answers with bullet points if necessary.
    
    💡 **Insight**
    [Your answer here]`
  }
];