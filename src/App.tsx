import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import HowItWorks from "./pages/HowItWorks";
import Contact from "./pages/Contact";
import Transactions from "./pages/Transactions";
import BankServices from "./pages/BankServices";
import BusinessAcquisition from "./pages/solutions/BusinessAcquisition";
import CommercialRealEstate from "./pages/solutions/CommercialRealEstate";
import WorkingCapital from "./pages/solutions/WorkingCapital";
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
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/bank-services" element={<BankServices />} />
          <Route path="/solutions/business-acquisition" element={<BusinessAcquisition />} />
          <Route path="/solutions/commercial-real-estate" element={<CommercialRealEstate />} />
          <Route path="/solutions/working-capital" element={<WorkingCapital />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
