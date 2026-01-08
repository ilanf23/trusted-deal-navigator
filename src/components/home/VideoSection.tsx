const VideoSection = () => {
  return <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            See How We Work
          </h2>
          <p className="text-lg text-muted-foreground">
            Listen to Brad (Founder of Commercial Lending X) explain how business owners and investors navigate complex financing.
          </p>
        </div>
        <div className="max-w-4xl mx-auto">
          <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-border/50">
            <iframe src="https://www.youtube.com/embed/z11ValptvRA?start=1" title="Commercial Lending X Overview" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="absolute inset-0 w-full h-full" />
          </div>
        </div>
      </div>
    </section>;
};
export default VideoSection;