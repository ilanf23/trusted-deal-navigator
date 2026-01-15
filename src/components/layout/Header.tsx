import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import logo from "@/assets/logo.png";
const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const navItems = [{
    label: "How It Works",
    href: "/how-it-works"
  }, {
    label: "Solutions",
    href: "#",
    submenu: [{
      label: "Business Acquisition & SBA",
      href: "/solutions/business-acquisition"
    }, {
      label: "Commercial Real Estate",
      href: "/solutions/commercial-real-estate"
    }, {
      label: "Working Capital & Equipment",
      href: "/solutions/working-capital"
    }]
  }, {
    label: "For Banks",
    href: "/bank-services"
  }, {
    label: "Transactions",
    href: "/transactions"
  }, {
    label: "Resources",
    href: "/resources"
  }];
  return <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="w-full px-4">
        <div className="flex items-center justify-between h-20 md:h-28">
          {/* Logo - Left aligned */}
          <Link to="/" className="flex items-start mt-2">
            <img src={logo} alt="Commercial Lending X" className="h-40 md:h-60" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2">
            {navItems.map(item => item.submenu ? <DropdownMenu key={item.label}>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 px-5 py-3 text-lg font-medium text-foreground/70 hover:text-foreground transition-colors whitespace-nowrap">
                      {item.label}
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-56">
                    {item.submenu.map(subItem => <DropdownMenuItem key={subItem.href} asChild>
                        <Link to={subItem.href} className="w-full cursor-pointer text-base py-2">
                          {subItem.label}
                        </Link>
                      </DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu> : <Link key={item.href} to={item.href} className={`px-5 py-3 text-lg font-medium transition-colors whitespace-nowrap ${isActive(item.href) ? "text-primary" : "text-foreground/70 hover:text-foreground"}`}>
                  {item.label}
                </Link>)}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <Link to="/auth">
              <Button variant="outline" size="default">
                Client Portal
              </Button>
            </Link>
            <Button 
              variant="hero" 
              size="default"
              onClick={() => {
                // @ts-ignore - Calendly is loaded via script
                window.Calendly?.initPopupWidget({
                  url: 'https://calendly.com/adam-fridman/30min'
                });
              }}
            >
              Talk to Brad
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button className="lg:hidden p-2 text-foreground" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle menu">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && <div className="lg:hidden py-4 border-t border-border animate-fade-in">
            <nav className="flex flex-col gap-2">
              {navItems.map(item => item.submenu ? <div key={item.label} className="space-y-1">
                    <span className="px-4 py-2 text-sm font-medium text-muted-foreground">
                      {item.label}
                    </span>
                    {item.submenu.map(subItem => <Link key={subItem.href} to={subItem.href} className="block px-8 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                        {subItem.label}
                      </Link>)}
                  </div> : <Link key={item.href} to={item.href} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isActive(item.href) ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`} onClick={() => setIsMobileMenuOpen(false)}>
                    {item.label}
                  </Link>)}
              <div className="pt-4 px-4">
                <Button 
                  variant="hero" 
                  className="w-full"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    // @ts-ignore - Calendly is loaded via script
                    window.Calendly?.initPopupWidget({
                      url: 'https://calendly.com/adam-fridman/30min'
                    });
                  }}
                >
                  Talk to Brad
                </Button>
              </div>
            </nav>
          </div>}
      </div>
    </header>;
};
export default Header;