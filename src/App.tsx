import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import PostDetail from "./pages/PostDetail";
import ForumPage from "./pages/ForumPage";
import ForumTopicDetail from "./pages/ForumTopicDetail";
import ResetPassword from "./pages/ResetPassword";
import Messages from "./pages/Messages";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/post/:postId" element={<PostDetail />} />
          <Route path="/forum" element={<ForumPage />} />
          <Route path="/forum/:id" element={<ForumTopicDetail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/help" element={<Help />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
