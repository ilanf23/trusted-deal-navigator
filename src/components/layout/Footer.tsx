import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Linkedin, Twitter } from "lucide-react";
import logo from "@/assets/logo.png";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    solutions: [
      { label: "Business Acquisition", href: "/solutions/business-acquisition" },
      { label: "Commercial Real Estate", href: "/solutions/commercial-real-estate" },
      { label: "Working Capital", href: "/solutions/working-capital" },
    ],
    company: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "Transactions", href: "/transactions" },
      { label: "Contact", href: "/contact" },
    ],
  };

  return (
    <footer className="bg-primary text-primary-foreground">
      {/* Main Footer */}
      <div className="section-container py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          {/* Brand Column */}
          <div>
            <Link to="/" className="inline-block mb-3">
              <img src={logo} alt="Commercial Lending X" className="h-20 brightness-0 invert" />
            </Link>
            <p className="text-primary-foreground/90 text-sm leading-relaxed">
              Commercial financing expertise for real world deals.
            </p>
          </div>

          {/* Solutions */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wide mb-3">Solutions</h4>
            <ul className="space-y-2">
              {footerLinks.solutions.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-primary-foreground/90 hover:text-primary-foreground transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wide mb-3">Company</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-primary-foreground/90 hover:text-primary-foreground transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wide mb-3">Contact</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="tel:+18476510319"
                  className="flex items-center gap-2 text-primary-foreground/90 hover:text-primary-foreground transition-colors text-sm"
                >
                  <Phone className="w-4 h-4" />
                  (847) 651-0319
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@commerciallendingx.com"
                  className="flex items-center gap-2 text-primary-foreground/90 hover:text-primary-foreground transition-colors text-sm"
                >
                  <Mail className="w-4 h-4" />
                  info@commerciallendingx.com
                </a>
              </li>
              <li className="flex items-center gap-3 mt-3">
                <a
                  href="#"
                  className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href="#"
                  className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
                  aria-label="Twitter"
                >
                  <Twitter className="w-4 h-4" />
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-primary-foreground/20">
        <div className="section-container py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-xs text-primary-foreground/80">
              © {currentYear} Commercial Lending X. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs">
              <Link
                to="/privacy"
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
