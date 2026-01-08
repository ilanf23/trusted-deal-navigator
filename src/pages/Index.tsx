import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import VideoSection from "@/components/home/VideoSection";
import AudiencePathways from "@/components/home/AudiencePathways";
import StatsSection from "@/components/home/StatsSection";
import RecentDeals from "@/components/home/RecentDeals";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import CTASection from "@/components/home/CTASection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <VideoSection />
        <AudiencePathways />
        <StatsSection />
        <RecentDeals />
        <TestimonialsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
