import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Header } from "./components/Header.jsx";
import { Footer } from "./components/Footer.jsx";
import { ChatWidget } from "./components/ChatWidget.jsx";
import { Home } from "./pages/Home.jsx";
import { Confirmation } from "./pages/Confirmation.jsx";
import { Manage } from "./pages/Manage.jsx";
import { Admin } from "./pages/Admin.jsx";
import { Billing } from "./pages/Billing.jsx";
import { Invoice } from "./pages/Invoice.jsx";

export default function App() {
  const [chatSignal, setChatSignal] = useState(0);
  return (
    <div className="min-h-screen">
      <Header />
      <Routes>
        <Route path="/" element={<Home onOpenChat={() => setChatSignal((n) => n + 1)} />} />
        <Route path="/confirmation/:id" element={<Confirmation />} />
        <Route path="/manage" element={<Manage />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/billing" element={<Billing />} />
        <Route path="/invoice/:id" element={<Invoice />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
      <ChatWidget openSignal={chatSignal} />
    </div>
  );
}
