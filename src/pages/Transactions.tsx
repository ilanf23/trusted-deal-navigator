import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Building2,
  Briefcase,
  CreditCard,
  RefreshCw,
  HardHat,
  ArrowRight,
  DollarSign,
} from "lucide-react";

interface Transaction {
  date: string;
  amount: string;
  title: string;
  description: string;
}

const businessAcquisitions: Transaction[] = [
  { date: "10/2025", amount: "$2,346,695", title: "Project Management Solutions Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a project management solutions business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to facilitate the acquisition." },
  { date: "10/2025", amount: "$1,048,000", title: "Floral Shop Business & Real Estate Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a floral shop business, as well as acquire the real estate the business operated from, with a 25-year term on all debt. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to facilitate the acquisition." },
  { date: "10/2025", amount: "$534,000", title: "Commercial Car Wash Business & Real Estate Acquisition", description: "The Client was seeking to acquire a commercial car wash business along with the real estate the business operated from utilizing the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition of both the business and real estate." },
  { date: "9/2025", amount: "$5,258,125", title: "Retail Furniture Business Acquisition (SBA 7A + Pari Passu)", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a retail furniture business, along with provide initial working capital post-acquisition. We were able to secure an SBA 7A approval with an additional conventional note on a pari passu basis matching the SBA terms to facilitate the acquisition." },
  { date: "9/2025", amount: "$4,342,000", title: "Truck Bed Installation & Service Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a truck bed installation and service business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "9/2025", amount: "$1,154,070", title: "Med Spa Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a med spa business, along with provide initial working capital post-acquisition. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "8/2025", amount: "$2,320,992", title: "Remodeling & Renovation Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a remodeling and renovation business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "8/2025", amount: "$1,076,600", title: "Specialized Service Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a specialized service business, along with obtain initial working capital. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "7/2025", amount: "$5,895,000", title: "Dessert Business Multi-Location Acquisition (SBA 7A + Pari Passu)", description: "The Client was seeking to acquire multiple franchise locations of a dessert business. We were able to secure an SBA 7A approval with an additional conventional note on a pari passu basis matching the SBA terms to facilitate the acquisition." },
  { date: "7/2025", amount: "$3,770,648", title: "CPA & Accounting Firm Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a remote based CPA and accounting firm business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "7/2025", amount: "$3,646,000", title: "Window & Door Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a window and door business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "7/2025", amount: "$1,127,853", title: "FedEx Route Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a FedEx Route business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "7/2025", amount: "$258,573", title: "Italian Restaurant Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of an Italian restaurant business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "6/2025", amount: "$4,896,085", title: "Optometry Practice Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire an optometry practice. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "6/2025", amount: "$4,490,336", title: "Electrical Contracting Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire an electrical contracting business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "6/2025", amount: "$4,400,375", title: "Manufacturing Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a manufacturing business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "6/2025", amount: "$3,195,755", title: "Manufacturing & Service Provider Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a manufacturing and service provider business, along with provide initial working capital post-acquisition. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "6/2025", amount: "$923,200", title: "Home Remodeling Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a home remodeling business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "6/2025", amount: "$524,344", title: "Batteries Plus Franchise Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire a Batteries Plus franchise location. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "5/2025", amount: "$2,922,089", title: "Garage Door Manufacturing Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a garage door manufacturing business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "5/2025", amount: "$2,368,286", title: "Construction Company Partial Ownership Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire 81% ownership in a construction company. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "5/2025", amount: "$1,722,109", title: "IT Consulting Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire an IT consulting business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "5/2025", amount: "$1,655,000", title: "Event Staffing Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of an event staffing business with 10% equity down plus a seller note. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "5/2025", amount: "$1,500,000", title: "Language Service Business Acquisition (90% Ownership)", description: "The Client was seeking to utilize the SBA 7A loan program to acquire 90% ownership of language service business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "5/2025", amount: "$1,087,242", title: "Auto Repair Shop Expansion", description: "The Client was seeking to utilize the SBA 7A loan program to acquire an auto repair shop to expand the footprint of the portfolio of auto repair shops they owned. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "5/2025", amount: "$466,000", title: "Handyman Service Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a handyman service business, along with provide initial working capital post-acquisition. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "4/2025", amount: "$5,000,000", title: "Construction Business Acquisition (80% Ownership)", description: "The Client was seeking to acquire 80% ownership interest in a construction business via the SBA 7A loan program. We were able to secure an SBA 7A approval at a solid fixed rate to facilitate the acquisition." },
  { date: "4/2025", amount: "$3,247,333", title: "Architectural Design Firm Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire 80% ownership interest in an architectural design firm. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "4/2025", amount: "$1,197,500", title: "Educational Support Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of an educational support business with 10% equity down plus a seller note. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "3/2025", amount: "$4,850,000", title: "Distribution Business Stock Purchase", description: "The Client was seeking to utilize the SBA 7A loan program to facilitate the 100% stock purchase of a distribution business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "3/2025", amount: "$4,563,227", title: "Cabling Technology Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a cabling technology business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "3/2025", amount: "$3,274,986", title: "Mailing & Courier Service Business + Real Estate", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a mailing and courier service business, as well as acquire the real estate the business operated from. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "3/2025", amount: "$3,122,930", title: "Manufacturing Business Acquisition (95% Ownership)", description: "The Client was seeking to acquire 95% ownership interest in a manufacturing business via the SBA 7A loan program. We were able to secure an SBA 7A approval at a solid fixed rate to facilitate the acquisition." },
  { date: "3/2025", amount: "$2,050,000", title: "FedEx Route & Assets Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire a FedEx route as well as all of the business assets / trucks. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to facilitate the acquisition." },
  { date: "3/2025", amount: "$907,500", title: "Online Mental Health Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of an online mental health business with 10% equity down plus a seller note. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "3/2025", amount: "$599,100", title: "Event Staffing Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of an event staffing business with 10% equity down plus a 10% seller note. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "3/2025", amount: "$427,000", title: "Restaurant Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a restaurant, along with fund initial working capital. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "2/2025", amount: "$2,373,485", title: "Window & Door Business Acquisition (81% Ownership)", description: "The Client was seeking to acquire 81% ownership interest in a window and door business via the SBA 7A loan program. We were able to secure an SBA 7A approval at a solid fixed rate to facilitate the acquisition." },
  { date: "2/2025", amount: "$1,196,223", title: "Electrical Contracting Business + Real Estate", description: "The Client was seeking to acquire an electrical contracting business along with the real estate the business operated from utilizing the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition of both the business and real estate." },
  { date: "2/2025", amount: "$831,250", title: "Independent Pharmacy Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of an independent pharmacy business with 2.5% equity down plus a seller note. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "1/2025", amount: "$6,000,000", title: "Pool Construction & Distribution Business (SBA + Pari Passu)", description: "The Client was seeking to acquire a pool construction and distribution business. We were able to secure an SBA 7A approval with an additional conventional note on a pari passu basis matching the SBA terms to facilitate the acquisition." },
  { date: "1/2025", amount: "$3,601,008", title: "Roofing Business Acquisition", description: "The Client was seeking to purchase a roofing business via the SBA 7A loan program. We were able to secure SBA 7A financing with a solid fixed rate to facilitate the acquisition." },
  { date: "1/2025", amount: "$2,784,677", title: "Commercial Janitorial Business Acquisition", description: "The Client was seeking to purchase a commercial janitorial business via the SBA 7A loan program. We were able to secure SBA 7A financing with a solid fixed rate to facilitate the acquisition." },
  { date: "1/2025", amount: "$2,488,577", title: "Digital Marketing Firm Acquisition", description: "The Client was seeking to purchase a digital marketing firm via the SBA 7A loan program. We were able to secure SBA 7A financing with a solid rate to facilitate the acquisition." },
  { date: "1/2025", amount: "$1,700,000", title: "Software Streaming Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a software streaming business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "1/2025", amount: "$1,445,000", title: "Mattress Manufacturing & Distribution Acquisition", description: "The Client was seeking to purchase a mattress manufacturing and distribution business via the SBA 7A loan program. We were able to secure SBA 7A financing with a solid fixed rate to facilitate the acquisition." },
  { date: "1/2025", amount: "$1,018,200", title: "Banquet & Event Business + Real Estate", description: "The Client was seeking to acquire a banquet and event business along with the real estate the business operated from utilizing the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition of both the business and real estate." },
  { date: "1/2025", amount: "$962,500", title: "Traffic Safety Education Business Acquisition", description: "The Client was seeking to purchase a traffic safety education business via the SBA 7A loan program. We were able to secure SBA 7A financing with a solid rate to facilitate the acquisition." },
  { date: "12/2024", amount: "$4,476,199", title: "Healthcare Reference & E-Learning Product Business", description: "The Client was seeking to purchase a healthcare reference and e-learning product business via the SBA 7A loan program. We were able to secure SBA 7A financing with a solid fixed rate to facilitate the acquisition." },
  { date: "12/2024", amount: "$2,303,000", title: "Software Business Acquisition", description: "The Client was seeking to purchase a software business via the SBA 7A loan program. We were able to secure SBA 7A financing with a solid fixed rate to facilitate the acquisition." },
  { date: "11/2024", amount: "$5,000,000", title: "Construction Business Acquisition", description: "The Client was seeking to purchase a construction business via the SBA 7A loan program. We were able to secure SBA 7A financing with a solid fixed rate to facilitate the acquisition." },
  { date: "11/2024", amount: "$3,513,617", title: "E-Commerce Beauty Product Business Acquisition", description: "The Client was seeking to purchase an e-commerce beauty product business via the SBA 7A loan program. We were able to secure SBA 7A financing with a solid fixed rate to facilitate the acquisition." },
  { date: "10/2024", amount: "$5,658,125", title: "Grocery Store Chain Acquisition (SBA + Pari Passu)", description: "The Client was seeking to acquire 100% ownership of a grocery store chain business with three locations. We were able to secure an SBA 7A approval with an additional conventional note on a pari passu basis matching the SBA terms to facilitate the acquisition." },
  { date: "10/2024", amount: "$3,719,242", title: "Online Marketing Business Stock Purchase", description: "The Client was seeking to utilize the SBA 7A loan program to facilitate the 100% stock purchase of an online marketing business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "10/2024", amount: "$3,102,367", title: "Retail Fireworks Business Acquisition", description: "The Client was seeking to purchase a retail fireworks business via the SBA 7A loan program. We were able to secure SBA 7A financing with a solid fixed rate to facilitate the acquisition." },
  { date: "10/2024", amount: "$1,924,063", title: "Property Management Company + Real Estate", description: "The Client was seeking to acquire a residential and commercial property management company along with the real estate the business operated from utilizing the SBA 7A loan program. We were able to secure SBA 7A financing at a solid rate to facilitate the acquisition of both the business and real estate." },
  { date: "10/2024", amount: "$1,338,200", title: "Energy Engineering Company Acquisition", description: "The Client was seeking to acquire 90% ownership interest in an energy focused engineering company for heating systems via the SBA 7A loan program. We were able to secure an SBA 7A approval at a solid fixed rate to facilitate the acquisition." },
  { date: "10/2024", amount: "$1,270,000", title: "Construction Company Stock & Real Estate", description: "The Client was seeking to utilize the SBA 7A loan program to facilitate the acquisition of the stock and real estate of a construction company. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "10/2024", amount: "$990,000", title: "Retail Grocery Store Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to facilitate the purchase of all business assets of a retail grocery store business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "9/2024", amount: "$2,049,824", title: "Automotive Business & Real Estate Acquisition", description: "The Client was seeking to acquire an automotive business and the real estate the business operated from utilizing the SBA 7A loan program. We were able to secure SBA financing at a reasonable rate to facilitate the acquisition." },
  { date: "9/2024", amount: "$1,648,861", title: "Laser Machining Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to facilitate the purchase of all business assets of a laser machining business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "9/2024", amount: "$805,000", title: "Commercial & Residential Cleaning Business", description: "The Client was seeking to acquire a commercial and residential cleaning business via the SBA 7A loan program. We were able to secure SBA 7A financing with a solid fixed rate to facilitate the acquisition." },
  { date: "8/2024", amount: "$1,932,536", title: "Safety Sales & Service Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a safety sales & service business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "8/2024", amount: "$1,915,000", title: "Printing & Sign Manufacturing Business", description: "The Client was seeking to utilize the SBA 7A loan program to acquire all of the business assets of a printing and sign manufacturing business, along with fund initial working capital. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "8/2024", amount: "$1,320,187", title: "Building Maintenance Service Business", description: "The Client was seeking to acquire a building maintenance service business utilizing the SBA 7A loan program. We were able to secure an SBA 7A financing at a reasonable rate to meet the Client's needs." },
  { date: "8/2024", amount: "$1,230,740", title: "Dental Practice Acquisition", description: "The Client was seeking to acquire all of the business assets of a dental practice utilizing the SBA 7A loan program. We were able to secure SBA 7A financing at a reasonable rate to facilitate the acquisition." },
  { date: "7/2024", amount: "$5,000,000", title: "Home Healthcare Business Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to facilitate the purchase 100% ownership of a home healthcare business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "7/2024", amount: "$4,317,919", title: "Temporary Staffing Company Partial Acquisition", description: "The Client was seeking to purchase a partial ownership interest in a temporary staffing company via the SBA 7A loan program. We were able to secure SBA 7A financing at a reasonable rate to facilitate the acquisition." },
  { date: "7/2024", amount: "$1,221,084", title: "River & Hiking Tour Business Acquisition", description: "The Client was seeking to acquire a river and hiking tour business via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "7/2024", amount: "$1,119,959", title: "Distribution Business Acquisition", description: "The Client was seeking to acquire a distribution business via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "7/2024", amount: "$664,600", title: "Franchise Business Start-Up", description: "The Client was seeking financing to start-up a franchise business utilizing the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to finance the start-up costs." },
  { date: "7/2024", amount: "$535,000", title: "Relief Remediation Business Acquisition", description: "The Client was seeking to acquire a relief remediation business via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "6/2024", amount: "$9,000,000", title: "Window Distribution Business (SBA + Pari Passu)", description: "The Client was seeking to acquire a window distribution business. We were able to secure an SBA 7A approval with an additional conventional note on a pari passu basis matching the SBA terms to facilitate the acquisition." },
  { date: "6/2024", amount: "$4,911,867", title: "Food Manufacturing Business Acquisition", description: "The Client was seeking to acquire a food manufacturing business via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "6/2024", amount: "$3,860,609", title: "Technology & Security Company Acquisition", description: "The Client was seeking to acquire a technology and security company via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "6/2024", amount: "$3,655,000", title: "Chemical Company Stock Purchase + Real Estate", description: "The Client was seeking to acquire a chemical company via a stock purchase, along with the industrial building the business operated from utilizing the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "6/2024", amount: "$3,430,000", title: "Commercial Cleaning Business + Real Estate", description: "The Client was seeking to acquire a commercial cleaning business along with the real estate the business operated from utilizing the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "6/2024", amount: "$2,922,445", title: "Beverage Company + Real Estate Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to purchase all of the business assets of a beverage company, along with the real estate the property operated out of. We were able to secure SBA 7A financing at a reasonable rate to facilitate the acquisition." },
  { date: "6/2024", amount: "$2,901,883", title: "Bed & Breakfast and Event Center Acquisition", description: "The Client was seeking to acquire a bed and breakfast and event center via the SBA 7A loan program. We were able to secure SBA 7A financing to facilitate the acquisition of the business and real estate." },
  { date: "6/2024", amount: "$2,170,000", title: "Plumbing & Heating Business Acquisition", description: "The Client was seeking to acquire a plumbing and heating business via the SBA 7A loan program with 5% equity down. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "6/2024", amount: "$1,109,847", title: "Food Manufacturing Business Acquisition", description: "The Client was seeking to acquire a food manufacturing business via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "5/2024", amount: "$5,000,000", title: "Trade Show Exhibit Company Acquisition", description: "The Client was seeking to acquire a trade show exhibit company via the SBA 7A loan program. We were able to secure an SBA 7A loan approval with a strong fixed rate to facilitate the acquisition." },
  { date: "5/2024", amount: "$961,649", title: "Web Application Development Business", description: "The Client was seeking to acquire all of the business assets of a web application development business via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "4/2024", amount: "$2,428,945", title: "Consulting Company Acquisition", description: "The Client was seeking to acquire a consulting company via the SBA 7A loan program. We were able to secure an SBA 7A loan approval with a solid fixed rate to facilitate the acquisition." },
  { date: "4/2024", amount: "$1,714,714", title: "Commercial Daycare Centers Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to purchase the business assets of two commercial daycare centers. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "4/2024", amount: "$1,231,197", title: "Electrical Contracting Business Acquisition", description: "The Client was seeking to acquire an electrical contracting business via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid rate to facilitate the acquisition." },
  { date: "3/2024", amount: "$5,000,000", title: "Media Business Stock Purchase", description: "The Client was seeking to acquire the stock purchase of a media business via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid rate to facilitate the acquisition." },
  { date: "3/2024", amount: "$4,346,398", title: "Two Manufacturing Businesses Acquisition", description: "The Client was seeking to acquire two manufacturing businesses via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid rate to facilitate the acquisition." },
  { date: "3/2024", amount: "$3,691,934", title: "Healthcare Staffing Business Acquisition", description: "The Client was seeking to acquire a healthcare staffing business via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid rate to facilitate the acquisition." },
  { date: "3/2024", amount: "$1,392,997", title: "Outdoor Recreation Center Acquisition (SBA 504)", description: "The Client was seeking to acquire an outdoor recreation center utilizing the SBA 504 loan program. We were able to secure an SBA 504 loan approval to facilitate the acquisition of the business and property." },
  { date: "3/2024", amount: "$1,382,931", title: "Pool Maintenance & Repair Business", description: "The Client was seeking to acquire a pool maintenance and repair business via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid rate to facilitate the acquisition." },
  { date: "2/2024", amount: "$3,930,500", title: "Food Distribution Business Stock Purchase", description: "The Client was seeking to facilitate the stock purchase of a food distribution business via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid rate with a creative seller note structure to facilitate the acquisition." },
  { date: "2/2024", amount: "$1,175,000", title: "Home Health Care Business Expansion", description: "The Client was seeking to utilize the SBA 7A loan program to facilitate the acquisition of an additional home health care business to grow their existing business. We were able to secure SBA financing at a reasonable rate to facilitate the acquisition." },
  { date: "2/2024", amount: "$780,000", title: "Digital Marketing Agency Acquisition", description: "The Client was seeking to acquire a digital marketing agency via the SBA 7A loan program. We were able to secure SBA 7A financing at a solid rate to facilitate the business acquisition." },
  { date: "1/2024", amount: "$4,700,000", title: "Industrial Building Purchase", description: "The Client was seeking to purchase a commercial / industrial building to relocate their business into. We were able to secure financing with a traditional lender at a strong fixed rate to facilitate the acquisition." },
];

const realEstateAcquisitions: Transaction[] = [
  { date: "10/2025", amount: "$3,500,000", title: "Assisted Living Facility Construction & Start-Up", description: "The Client was seeking to utilize the SBA 7A loan program to finance the construction of a new assisted living facility, as well as fund start-up costs for the business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "9/2025", amount: "$1,700,000", title: "Medical Office Building Acquisition", description: "The Client was seeking to acquire a medical office building to hold as an investment property. We were able to secure financing with a traditional lender at a reasonable rate to facilitate the acquisition." },
  { date: "7/2025", amount: "$374,000", title: "Owner-Occupied Auto Repair Shop", description: "The Client was seeking to utilize the SBA 7A loan program to facilitate the acquisition of an owner-occupied auto repair shop. We were able to secure an SBA 7A financing with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "7/2025", amount: "$272,000", title: "Commercial Office Condo Acquisition", description: "The Client was seeking to acquire a commercial office condo to owner-occupy with their healthcare business. We were able to secure financing with a traditional lender at a reasonable rate to facilitate the acquisition." },
  { date: "6/2025", amount: "$1,992,800", title: "Industrial Property Acquisition & Construction", description: "The Client was seeking to utilize the SBA 7A loan program to acquire an industrial property and construct a commercial building on site to be owner-occupied by their business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "5/2025", amount: "$1,650,000", title: "Commercial / Industrial Property Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to facilitate the acquisition of an owner-occupied commercial / industrial property. We were able to secure an SBA 7A financing with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "5/2025", amount: "$1,050,000", title: "Mixed-Use Retail & Residential Acquisition", description: "The Client was seeking to utilize the SBA 7A loan program to acquire and rehab a mixed-use retail and residential apartment building, that would be partially owner-occupied by the Borrowers business. We were able to secure an SBA 7A approval with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "3/2025", amount: "$1,296,000", title: "Industrial Building Purchase", description: "The Client was seeking to purchase a commercial / industrial building to relocate their business into, as well as utilize the SBA 7A loan program to refinance some existing business debt at the same time. We were able to secure SBA 7A financing with at a strong fixed rate to facilitate the acquisition." },
  { date: "1/2025", amount: "$1,470,150", title: "Commercial Daycare Facility Acquisition (SBA 504)", description: "The Client was seeking to purchase a commercial daycare facility. We were able to secure an SBA 504 loan approval to facilitate the acquisition, securing them a very attractive 25-year fixed rate on a portion of the debt." },
  { date: "12/2024", amount: "$1,226,250", title: "6-Unit Apartment Building Acquisition", description: "The Client was seeking to purchase a 6-unit apartment building to hold as an investment property. We were able to secure financing with a traditional lender at a reasonable fixed rate to facilitate the acquisition." },
  { date: "10/2024", amount: "$2,250,000", title: "Industrial Property Acquisition (SBA 504)", description: "The Client was seeking to purchase a commercial / industrial building to move their safety manufacturing business into. We were able to secure an SBA 504 loan approval to facilitate the acquisition." },
  { date: "9/2024", amount: "$716,250", title: "8-Unit Apartment Building Acquisition", description: "The Client was seeking to purchase an 8-unit apartment building to hold as an investment property. We were able to secure financing with a traditional lender at a reasonable fixed rate to facilitate the acquisition." },
  { date: "9/2024", amount: "$620,500", title: "Commercial Property Acquisition", description: "The Client was seeking to acquire a commercial property that they owner-occupied with a recently acquired business utilizing the SBA 7A loan program. We were able to secure SBA 7A financing at a solid fixed rate to facilitate the acquisition." },
  { date: "7/2024", amount: "$20,000,000", title: "Commercial Bridge Loan - Land Acquisition", description: "The Client was seeking a commercial bridge loan to facilitate the acquisition of two parcels of land for a future development project. We were able to secure hard money financing with a private lender to meet the Client's needs." },
  { date: "7/2024", amount: "$1,140,000", title: "Mixed-Use Building Acquisition", description: "The Client was seeking to purchase a commercial / mixed-use property that they partially owner-occupied with their restaurant. We were able to secure financing with a traditional lender at a solid rate to facilitate the acquisition." },
  { date: "7/2024", amount: "$646,875", title: "Commercial Office Condo Acquisition", description: "The Client was seeking to acquire two commercial office condos in a building where they operated a business. We were able to secure financing with a traditional lender at a reasonable rate to facilitate the acquisition." },
  { date: "6/2024", amount: "$690,000", title: "6-Unit Apartment Building Acquisition", description: "The Client was seeking to purchase a 6-unit apartment building to hold as an investment property. We were able to secure financing with a traditional lender at a reasonable fixed rate to facilitate the acquisition." },
  { date: "4/2024", amount: "$5,535,000", title: "Daycare Centers Real Estate (SBA 504)", description: "The Client was seeking to purchase the real estate associated with two commercial daycare centers they were also seeking to acquire. We were able to secure an SBA 504 loan approval to facilitate the acquisition." },
  { date: "4/2024", amount: "$693,000", title: "Office Building Acquisition & Improvement", description: "The Client was seeking to purchase and improve an office building they intended to move their medical practice into. We were able to secure an SBA 504 loan approval to facilitate the acquisition and improvements." },
  { date: "4/2024", amount: "$545,580", title: "Industrial Condo Acquisition (SBA 504)", description: "The Client was seeking to acquire a commercial / industrial condominium to relocate their business utilizing the SBA 504 loan program. We were able to secure an SBA 504 loan approval to facilitate the acquisition." },
  { date: "4/2024", amount: "$400,000", title: "Multi-Tenant Retail Building Acquisition", description: "The Client was seeking to acquire a multi-tenant retail building to hold as an investment property. We were able to secure financing with a traditional lender at a strong fixed rate to facilitate the acquisition." },
  { date: "3/2024", amount: "$544,000", title: "Mixed-Use Property Purchase & Rehab", description: "The Client was seeking to acquire a commercial mixed-use property and fund the build-out of the property to be able to owner-occupy with their business. We were able to secure SBA 7A financing at a solid rate to facilitate the acquisition and rehab." },
  { date: "3/2024", amount: "$408,600", title: "Retail Building Purchase", description: "The Client was seeking to acquire the retail building they occupied with their business. We were able to secure financing with a traditional lender at a strong fixed rate to facilitate the acquisition." },
  { date: "3/2024", amount: "$294,000", title: "Apartment Building Investment Purchase", description: "The Client was seeking to acquire a commercial apartment building to hold as an investment rental property. We were able to secure financing with a strong fixed rate with a 30-year loan term to meet the Client's needs." },
  { date: "3/2024", amount: "$2,250,000", title: "Industrial Buildings Acquisition (SBA 504)", description: "The Client was seeking to acquire the industrial buildings of a recently acquired business. We were able to secure an SBA 504 loan approval to facilitate the acquisition of the buildings." },
  { date: "1/2024", amount: "$581,250", title: "Industrial Property Investment Purchase", description: "The Client was seeking to purchase a leased commercial / industrial property to hold as an investment property. We were able to secure financing with a traditional lender at a strong fixed rate to facilitate the acquisition." },
  { date: "1/2024", amount: "$350,000", title: "Land Acquisition", description: "The Client was seeking to acquire vacant land adjacent to the real estate that they already owned and operated their business from. We were able to secure financing with a traditional lender at a reasonable rate to facilitate the acquisition." },
];

const linesOfCredit: Transaction[] = [
  { date: "10/2025", amount: "$250,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "10/2025", amount: "$100,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "9/2025", amount: "$400,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "7/2025", amount: "$250,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "6/2025", amount: "$500,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "6/2025", amount: "$500,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "6/2025", amount: "$100,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "5/2025", amount: "$100,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "4/2025", amount: "$250,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "3/2025", amount: "$250,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "1/2025", amount: "$250,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "12/2024", amount: "$500,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "9/2024", amount: "$80,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "8/2024", amount: "$300,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "6/2024", amount: "$500,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "6/2024", amount: "$500,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "6/2024", amount: "$150,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "5/2024", amount: "$250,000", title: "Working Capital Line of Credit", description: "The Client was seeking to acquire a commercial line of credit to facilitate working capital for a newly acquired business. We were able to secure SBA financing at an attractive rate to meet the Client's needs." },
  { date: "4/2024", amount: "$500,000", title: "Working Capital Line of Credit", description: "The Client was seeking to obtain a commercial line of credit to provide working capital for their business. We were able to secure a line of credit at an attractive rate to meet the Client's working capital needs." },
];

const refinancing: Transaction[] = [
  { date: "8/2025", amount: "$600,000", title: "SBA 7A Refinance", description: "The Client was seeking to refinance their original SBA 7A business acquisition loan. We were able to secure an SBA 7A refinance with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "7/2025", amount: "$800,000", title: "Mixed-Use Building Cash-Out Refinance", description: "The Client was seeking to do a cash-out refinance on a recently rehabbed mixed-use retail and residential apartment building into a traditional end-loan, with cash out used to reimburse the Borrower for personal cash into improvements for the property. We were able to secure financing with a traditional lender at an attractive fixed rate." },
  { date: "7/2025", amount: "$530,000", title: "Commercial / Retail Buildings Refinance", description: "The Client was seeking to do a cash-out refinance on two commercial / retail buildings owned free and clear to utilize for future investment opportunities. We were able to secure financing with a traditional lender at an attractive fixed rate." },
  { date: "5/2025", amount: "$4,337,167", title: "Business Debt Refinance & Expansion", description: "The Client was seeking to refinance and consolidate existing business debt, along with fund the expansion of their business into a new leased space. We were able to secure an SBA 7A refinance with a traditional lender at a solid rate to meet the Client's needs." },
  { date: "4/2025", amount: "$1,400,000", title: "Business Debt Consolidation", description: "The Client was seeking to refinance their existing short-term and high interest rate business debt into one term loan, along with provide fresh working capital to the business. We were able to secure a 10 year term with the working capital need included with an SBA 7A loan." },
  { date: "4/2025", amount: "$884,000", title: "Gas Station & Convenience Store Refinance", description: "The Client was seeking to do a cash-out refinance on an existing gas station purchased with cash. We were able to secure financing with a traditional lender at an attractive fixed rate." },
  { date: "4/2025", amount: "$734,500", title: "Gas Station & Convenience Store Refinance", description: "The Client was seeking to do a cash-out refinance on an existing gas station purchased with cash. We were able to secure financing with a traditional lender at an attractive fixed rate." },
  { date: "3/2025", amount: "$1,470,000", title: "Apartment Building Refinance", description: "The Client was seeking to refinance the existing mortgage on an apartment building they owned as an investment property, along with take cash out to fund future investment property acquisitions. We were able to secure an approval with a traditional lender at a reasonable fixed rate." },
  { date: "3/2025", amount: "$650,000", title: "Multi-Family Investment Property Refinance", description: "The Client was seeking to refinance the existing mortgage on a multi-family investment property along with take cash out to reimburse for improvements they made to the property. We were able to secure an approval with a traditional lender at a strong fixed rate." },
  { date: "1/2025", amount: "$1,260,000", title: "Apartment Building Refinance", description: "The Client was seeking to refinance the existing mortgage on a commercial apartment building that they held as an investment property. We were able to secure an approval with a traditional lender at a reasonable fixed rate." },
  { date: "1/2025", amount: "$760,000", title: "Apartment Building Refinance", description: "The Client was seeking to refinance the existing mortgage on a commercial apartment building that they held as an investment property. We were able to secure an approval with a traditional lender at a reasonable fixed rate." },
  { date: "7/2024", amount: "$1,200,000", title: "Commercial Bridge Loan", description: "The Client was seeking a commercial bridge loan to facilitate the refinance of existing business debt and fund additional working capital. We were able to secure hard money financing with a private lender to meet the Client's needs." },
  { date: "7/2024", amount: "$995,000", title: "Commercial Mortgage Refinance", description: "The Client was seeking to refinance their original SBA 7A acquisition loan for the property they owner-occupied with their business into a conventional commercial mortgage loan. We were able to secure financing with a traditional lender at a strong fixed rate." },
  { date: "7/2024", amount: "$630,000", title: "Business Debt Refinance", description: "The Client was seeking to refinance existing business debt. We were able to secure financing with a traditional lender at a strong rate to facilitate the refinance." },
  { date: "5/2024", amount: "$1,400,000", title: "Mixed-Use Building Refinance", description: "The Client was seeking to refinance the existing mortgage on a mixed-use commercial and apartment building, along with take cash out to fund future investment property acquisitions. We were able to secure an approval with a traditional lender at a reasonable fixed rate." },
  { date: "4/2024", amount: "$2,134,500", title: "Industrial Property & Business Debt Refinance", description: "The Client was seeking to refinance the existing mortgage on the industrial property they owner occupied with their business, as well as refinance the existing business debt. We were able to secure a strong fixed rate with a traditional lender." },
  { date: "3/2024", amount: "$2,296,000", title: "Banquet Facility Refinance (SBA 504)", description: "The Client was seeking to refinance the existing mortgage and business debt on a banquet facility. We were able to secure an SBA 504 loan approval to facilitate the refinance of the property and debt consolidation." },
  { date: "2/2024", amount: "$1,075,000", title: "Restaurant Properties Cash-Out Refinance", description: "The Client was seeking to refinance the existing mortgages on three restaurant properties they owned to facilitate cash out to pay off business debt and expand the business. We were able to secure financing with a traditional lender at a strong fixed rate." },
  { date: "2/2024", amount: "$622,000", title: "Mixed-Use Building Bridge Refinance", description: "The Client was seeking a commercial bridge loan to refinance and make updates to a mixed-use commercial / apartment building they owned as an investment property. We were able to secure an approval with a non-bank lender." },
  { date: "1/2024", amount: "$300,000", title: "Refinance Mixed-Use Building", description: "The Client was seeking a commercial bridge loan to refinance the existing debt on a mixed-used retail and apartment building. We were able to secure hard money financing with a private lender to meet the Client's needs." },
];

const constructionLoans: Transaction[] = [
  { date: "10/2024", amount: "$3,039,000", title: "Banquet Facility Construction", description: "The Client was seeking to refinance their original commercial mortgage as well as fund the construction of a new banquet facility adjoining the existing facility. We were able to secure financing with a traditional lender at a strong fixed rate to facilitate the construction to end loan." },
  { date: "10/2024", amount: "$778,000", title: "Medical Clinic Start-Up", description: "The Client was seeking an SBA 7A loan to facilitate the build-out and start-up costs for a new medical clinic. We were able to secure SBA 7A financing with a solid rate to meet the Client's needs." },
  { date: "8/2024", amount: "$7,485,000", title: "Ice Arena Conversion", description: "The Client was seeking a construction to end loan to facilitate the conversion of an industrial building into an Ice Arena. We were able to secure financing with a traditional lender at a solid rate." },
  { date: "6/2024", amount: "$1,800,000", title: "Golf Club Construction", description: "The Client was seeking to refinance their original commercial mortgage as well as fund the construction of a clubhouse and rental cottages for their golf club. We were able to secure SBA 7A financing with a traditional lender at a solid rate." },
  { date: "2/2024", amount: "$6,000,000", title: "6-Unit Condominium Construction", description: "The Client was seeking to finance the construction of a new 6-unit condominium project. We were able to secure construction financing at a solid rate to meet the Client's needs." },
  { date: "2/2024", amount: "$3,507,135", title: "Daycare Facility Construction", description: "The Client was seeking a commercial construction to end loan to construct a new daycare facility. We were able to secure financing with a traditional lender at a solid rate." },
  { date: "2/2024", amount: "$880,000", title: "Commercial Property Build-Out & Start-Up", description: "The Client was seeking SBA 7A financing to facilitate the build-out of a commercial property and fund start-up costs to open a new location for their business. We were able to secure SBA 7A financing at a solid rate." },
  { date: "1/2024", amount: "$600,000", title: "Equipment Financing", description: "The Client was seeking to acquire new equipment for their business via the SBA 7A loan program. We were able to secure an SBA 7A Equipment loan at a strong fixed rate to facilitate the acquisition of additional equipment." },
];

const categories = [
  { 
    id: "business-acquisitions", 
    label: "Business Acquisitions", 
    icon: Briefcase, 
    transactions: businessAcquisitions,
    count: businessAcquisitions.length,
    totalAmount: "$200M+"
  },
  { 
    id: "real-estate", 
    label: "Real Estate Acquisitions", 
    icon: Building2, 
    transactions: realEstateAcquisitions,
    count: realEstateAcquisitions.length,
    totalAmount: "$50M+"
  },
  { 
    id: "lines-of-credit", 
    label: "Lines of Credit", 
    icon: CreditCard, 
    transactions: linesOfCredit,
    count: linesOfCredit.length,
    totalAmount: "$6M+"
  },
  { 
    id: "refinancing", 
    label: "Refinancing", 
    icon: RefreshCw, 
    transactions: refinancing,
    count: refinancing.length,
    totalAmount: "$25M+"
  },
  { 
    id: "construction", 
    label: "Construction & Equipment", 
    icon: HardHat, 
    transactions: constructionLoans,
    count: constructionLoans.length,
    totalAmount: "$24M+"
  },
];

const formatAmount = (amount: string) => {
  return amount;
};

const Transactions = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 bg-muted">
          <div className="section-container">
            <div className="max-w-3xl">
              <h1 className="mb-6">Our Transactions</h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Below is a summary of recent transactions approved and/or closed over the past several years. 
                Additional information and references can be provided upon request.
              </p>
            </div>
          </div>
        </section>

        {/* Summary Stats */}
        <section className="py-12 border-b border-border">
          <div className="section-container">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {categories.map((category) => (
                <div key={category.id} className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <category.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{category.count}</div>
                  <div className="text-sm text-muted-foreground">{category.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Transaction Categories */}
        <section className="py-16">
          <div className="section-container">
            <Accordion type="multiple" className="space-y-4">
              {categories.map((category) => (
                <AccordionItem 
                  key={category.id} 
                  value={category.id}
                  className="border border-border rounded-xl overflow-hidden bg-card"
                >
                  <AccordionTrigger className="px-6 py-5 hover:no-underline hover:bg-muted/50">
                    <div className="flex items-center gap-4 w-full">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <category.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-lg font-semibold text-foreground">{category.label}</h3>
                        <p className="text-sm text-muted-foreground">
                          {category.count} transactions • {category.totalAmount} funded
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="space-y-4 pt-2">
                      {category.transactions.map((transaction, index) => (
                        <div 
                          key={index}
                          className="p-4 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                                {transaction.date}
                              </span>
                              <span className="text-lg font-bold text-primary flex items-center gap-1">
                                <DollarSign className="w-4 h-4" />
                                {formatAmount(transaction.amount).replace('$', '')}
                              </span>
                            </div>
                          </div>
                          <h4 className="font-semibold text-foreground mb-2">{transaction.title}</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {transaction.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 hero-gradient">
          <div className="section-container text-center">
            <h2 className="text-primary-foreground mb-6">
              Have a Deal That Needs Financing?
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Let's discuss your specific situation and find the right financing solution.
            </p>
            <Link to="/contact">
              <Button variant="hero" size="xl" className="group">
                Talk to Brad
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Transactions;
