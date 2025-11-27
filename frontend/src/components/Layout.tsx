import { Routes, Route } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Chat from '../pages/Chat';

export default function Layout() {
  return (
    <div className="h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route path="/chat/:conversationId?" element={<Chat />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

