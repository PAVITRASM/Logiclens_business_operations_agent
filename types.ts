import React from 'react';

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  systemInstruction: string;
  greeting: string;
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export interface StatsData {
  tasks: number;
  events: number;
  calls: number;
  queries: number;
  completed: number;
}