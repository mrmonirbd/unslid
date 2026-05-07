export type ServiceDeckSlide = {
  title: string;
  subtitle: string;
  bullets: string[];
  visual: "hero" | "metrics" | "timeline" | "comparison" | "process" | "pricing" | "case-study" | "closing";
};

export type ServiceDeck = {
  id: string;
  title: string;
  category: string;
  audience: string;
  style: string;
  accent: string;
  summary: string;
  slides: ServiceDeckSlide[];
};

const concepts = [
  ["startup-pitch-premium", "Premium Startup Pitch Deck", "Investor", "Founders raising pre-seed or seed funding", "cinematic dark"],
  ["saas-sales-demo", "SaaS Sales Demo Deck", "Sales", "B2B SaaS buyers and demo calls", "clean blue"],
  ["agency-proposal-luxe", "Creative Agency Proposal", "Proposal", "Brands hiring a design or marketing agency", "editorial luxe"],
  ["restaurant-launch", "Restaurant Launch Pitch", "Food", "Restaurant partners and local investors", "warm appetizing"],
  ["ecommerce-brand-kit", "Ecommerce Brand Launch", "Ecommerce", "DTC founders and online store launches", "bold retail"],
  ["real-estate-listing", "Real Estate Listing Presentation", "Real Estate", "Property sellers and buyers", "premium minimal"],
  ["fitness-coach-offer", "Fitness Coaching Offer Deck", "Health", "Personal trainers and fitness programs", "energetic neon"],
  ["online-course-launch", "Online Course Launch", "Education", "Course creators and coaches", "bright learning"],
  ["mobile-app-investor", "Mobile App Investor Deck", "Investor", "App founders pitching investors", "glassmorphism"],
  ["fashion-lookbook", "Fashion Brand Lookbook", "Fashion", "Clothing labels and boutiques", "magazine style"],
  ["beauty-salon-menu", "Beauty Salon Services Deck", "Beauty", "Salon, spa, and beauty customers", "soft premium"],
  ["consulting-strategy", "Management Consulting Strategy", "Consulting", "Executives and decision makers", "sharp corporate"],
  ["nonprofit-fundraising", "Nonprofit Fundraising Deck", "Nonprofit", "Donors, sponsors, and grant committees", "human warm"],
  ["event-sponsorship", "Event Sponsorship Proposal", "Events", "Sponsors and brand partners", "high energy"],
  ["medical-clinic-intro", "Private Clinic Introduction", "Healthcare", "Patients, partners, and health investors", "calm clinical"],
  ["fintech-product", "Fintech Product Pitch", "Finance", "Banks, fintech users, and investors", "trust blue"],
  ["ai-automation-service", "AI Automation Service Deck", "AI", "Small businesses buying automation", "futuristic"],
  ["cybersecurity-audit", "Cybersecurity Audit Proposal", "Security", "IT leaders and compliance teams", "dark technical"],
  ["hr-recruiting-service", "Recruiting Service Pitch", "HR", "Companies hiring talent partners", "friendly professional"],
  ["travel-agency-offer", "Luxury Travel Agency Deck", "Travel", "Travel clients and corporate retreat buyers", "sunlit premium"],
  ["wedding-planner", "Wedding Planner Portfolio", "Events", "Couples and families", "romantic editorial"],
  ["interior-design", "Interior Design Proposal", "Design", "Homeowners and commercial clients", "quiet luxury"],
  ["architecture-studio", "Architecture Studio Profile", "Architecture", "Developers and property owners", "monochrome premium"],
  ["software-dev-agency", "Software Development Agency", "Technology", "Clients outsourcing product builds", "modern technical"],
  ["cloud-migration", "Cloud Migration Proposal", "Technology", "CTOs and infrastructure teams", "enterprise blue"],
  ["marketing-retainer", "Marketing Retainer Pitch", "Marketing", "Businesses buying monthly growth services", "bold growth"],
  ["social-media-kit", "Social Media Management Deck", "Marketing", "Creators and small businesses", "playful pop"],
  ["brand-identity", "Brand Identity Proposal", "Branding", "Startups and rebrands", "design studio"],
  ["photography-portfolio", "Photography Service Deck", "Creative", "Couples, brands, and agencies", "visual gallery"],
  ["video-production", "Video Production Proposal", "Creative", "Brands needing campaign videos", "cinematic"],
  ["podcast-sponsorship", "Podcast Sponsorship Deck", "Media", "Advertisers and sponsors", "audio modern"],
  ["newsletter-media-kit", "Newsletter Media Kit", "Media", "Advertisers and partners", "clean editorial"],
  ["influencer-media-kit", "Influencer Media Kit", "Creator", "Brands booking creator campaigns", "vibrant creator"],
  ["coaching-program", "Business Coaching Program", "Coaching", "Entrepreneurs buying coaching", "confident premium"],
  ["legal-service", "Law Firm Service Deck", "Legal", "Business clients and founders", "classic trust"],
  ["accounting-service", "Accounting Services Pitch", "Finance", "SMBs needing bookkeeping and tax", "organized calm"],
  ["insurance-broker", "Insurance Broker Proposal", "Finance", "Families and business owners", "secure professional"],
  ["logistics-company", "Logistics Company Profile", "Operations", "Retailers and manufacturers", "industrial clean"],
  ["manufacturing-profile", "Manufacturing Capability Deck", "Manufacturing", "B2B buyers and procurement teams", "factory modern"],
  ["construction-bid", "Construction Bid Presentation", "Construction", "Developers and project owners", "strong practical"],
  ["solar-energy", "Solar Energy Proposal", "Energy", "Homeowners and businesses", "green future"],
  ["cleaning-service", "Commercial Cleaning Proposal", "Local Service", "Offices and property managers", "fresh clear"],
  ["car-rental", "Car Rental Business Deck", "Mobility", "Travelers and corporate clients", "sleek automotive"],
  ["auto-detailing", "Auto Detailing Offer", "Local Service", "Car owners and fleets", "glossy premium"],
  ["pet-care", "Pet Care Service Deck", "Local Service", "Pet owners", "friendly warm"],
  ["childcare-center", "Childcare Center Pitch", "Education", "Parents and community partners", "gentle bright"],
  ["language-school", "Language School Presentation", "Education", "Students and parents", "global learning"],
  ["edtech-platform", "EdTech Platform Deck", "Education", "Schools and education investors", "smart academic"],
  ["mental-health-app", "Mental Health App Pitch", "Health", "Users, clinics, and investors", "calm digital"],
  ["nutrition-brand", "Nutrition Brand Launch", "Health", "Wellness customers and retailers", "fresh wellness"],
  ["coffee-shop", "Coffee Shop Launch Deck", "Food", "Local partners and lenders", "cozy premium"],
  ["bakery-brand", "Bakery Brand Presentation", "Food", "Customers, suppliers, and franchise partners", "sweet artisan"],
  ["food-truck", "Food Truck Business Deck", "Food", "Street food investors and event hosts", "urban bold"],
  ["catering-service", "Catering Service Proposal", "Food", "Corporate and private event buyers", "elegant appetizing"],
  ["hotel-profile", "Boutique Hotel Profile", "Hospitality", "Travelers and booking partners", "boutique luxury"],
  ["coworking-space", "Coworking Space Pitch", "Real Estate", "Remote workers and startup teams", "community modern"],
  ["subscription-box", "Subscription Box Launch", "Ecommerce", "Consumers and DTC investors", "delightful retail"],
  ["marketplace-startup", "Marketplace Startup Pitch", "Startup", "Investors and early partners", "networked modern"],
  ["b2b-lead-gen", "B2B Lead Generation Service", "Sales", "Companies needing qualified leads", "direct response"],
  ["sales-training", "Sales Training Program", "Training", "Sales leaders and teams", "performance bold"],
  ["customer-support", "Customer Support Outsourcing", "Operations", "Businesses scaling support", "service calm"],
  ["virtual-assistant", "Virtual Assistant Services", "Operations", "Founders and busy executives", "efficient friendly"],
  ["data-analytics", "Data Analytics Consulting", "Data", "Executives and operators", "insightful dark"],
  ["bi-dashboard", "BI Dashboard Proposal", "Data", "Management and reporting teams", "dashboard polished"],
  ["research-report", "Market Research Report", "Research", "Strategy and product teams", "analytical editorial"],
  ["product-launch", "Product Launch Campaign", "Marketing", "Launch teams and stakeholders", "high-impact"],
  ["go-to-market", "Go-To-Market Strategy", "Strategy", "Founders and growth leaders", "strategic crisp"],
  ["fundraising-story", "Fundraising Story Deck", "Investor", "Impact startups and donors", "emotional premium"],
  ["board-update", "Board Update Presentation", "Executive", "Boards and leadership teams", "executive clean"],
  ["quarterly-business-review", "Quarterly Business Review", "Executive", "Clients and account teams", "data polished"],
  ["annual-report", "Annual Report Deck", "Corporate", "Stakeholders and management", "formal modern"],
  ["training-workshop", "Training Workshop Deck", "Training", "Workshop attendees", "interactive clear"],
  ["webinar-pitch", "Webinar Sales Deck", "Sales", "Webinar attendees and leads", "conversion focused"],
  ["challenge-webinar", "5-Day Challenge Deck", "Creator", "Online challenge participants", "energetic coach"],
  ["community-launch", "Community Launch Deck", "Community", "Members and sponsors", "warm social"],
  ["membership-site", "Membership Site Pitch", "Creator", "Subscribers and learners", "premium digital"],
  ["nft-creative", "Digital Collectibles Pitch", "Web3", "Collectors and creative partners", "bold digital"],
  ["crypto-education", "Crypto Education Deck", "Finance", "New crypto learners", "dark neon"],
  ["gaming-studio", "Gaming Studio Pitch", "Gaming", "Publishers and investors", "immersive bold"],
  ["esports-team", "Esports Sponsorship Deck", "Gaming", "Sponsors and fans", "electric sports"],
  ["music-artist", "Music Artist Press Kit", "Entertainment", "Labels, venues, and sponsors", "stage editorial"],
  ["film-pitch", "Film Project Pitch Deck", "Entertainment", "Producers and investors", "cinematic noir"],
  ["book-launch", "Book Launch Campaign", "Publishing", "Readers, media, and bookstores", "literary modern"],
  ["personal-brand", "Personal Brand Deck", "Creator", "Clients, sponsors, and partners", "signature clean"],
  ["speaker-kit", "Speaker Kit Presentation", "Speaking", "Event organizers", "confident stage"],
  ["portfolio-career", "Professional Portfolio Deck", "Career", "Recruiters and clients", "minimal premium"],
  ["resume-story", "Executive Resume Deck", "Career", "Hiring panels and recruiters", "executive personal"],
  ["grant-proposal", "Grant Proposal Deck", "Nonprofit", "Grant reviewers and institutions", "clear impact"],
  ["municipal-project", "City Project Proposal", "Government", "Officials and citizens", "public service"],
  ["university-program", "University Program Pitch", "Education", "Students, parents, and faculty", "academic bold"],
  ["museum-exhibit", "Museum Exhibit Proposal", "Culture", "Curators and sponsors", "cultural editorial"],
  ["art-gallery", "Art Gallery Portfolio", "Culture", "Collectors and visitors", "gallery minimal"],
  ["sports-club", "Sports Club Sponsorship", "Sports", "Sponsors and community partners", "dynamic sports"],
  ["ngo-awareness", "Awareness Campaign Deck", "Nonprofit", "Communities, donors, and media", "human impact"],
  ["franchise-sales", "Franchise Sales Deck", "Business", "Potential franchisees", "trustworthy commercial"],
  ["investor-one-pager-expanded", "Investor Intro Deck", "Investor", "Busy investors needing a quick read", "punchy minimal"],
  ["premium-pitch-service", "Presentation Design Service Sales Deck", "Sales", "Businesses buying presentation design", "showcase premium"],
  ["done-for-you-decks", "Done-For-You Deck Service", "Sales", "Founders, coaches, and agencies", "bold service"],
  ["pitch-deck-redesign", "Pitch Deck Redesign Offer", "Sales", "Startups with outdated investor decks", "before-after premium"],
  ["corporate-template-pack", "Corporate Template Pack Sales", "Sales", "Teams needing branded slide systems", "enterprise polished"],
];

const slideBlueprints = [
  ["The Big Promise", "Open with the outcome the client wants most.", ["Clear headline", "Immediate value", "Memorable visual direction"], "hero"],
  ["Why It Matters Now", "Frame urgency and market timing.", ["Attention is expensive", "Trust is visual", "Fast teams win with better decks"], "metrics"],
  ["Audience Pain Points", "Show that the deck understands the buyer.", ["Message feels unclear", "Slides look generic", "Design slows down sales"], "comparison"],
  ["The Service Offer", "Present the solution as a crisp packaged offer.", ["Strategy", "Design", "Copywriting", "Delivery-ready files"], "process"],
  ["Proof And Differentiation", "Explain what makes the service credible.", ["Custom storytelling", "Premium visual systems", "Fast revision workflow"], "case-study"],
  ["Packages Or Engagement", "Make buying feel simple and structured.", ["Starter", "Professional", "Premium"], "pricing"],
  ["Next Step", "Close with a direct call to action.", ["Book a discovery call", "Send existing deck", "Receive timeline and quote"], "closing"],
] as const;

const accents = ["#5146E5", "#06B6D4", "#F97316", "#16A34A", "#DB2777", "#111827", "#7C3AED", "#DC2626"];

export const onlinePresentationServiceDecks = concepts.map((concept, index): ServiceDeck => {
  const [id, title, category, audience, style] = concept;
  return {
    id,
    title,
    category,
    audience,
    style,
    accent: accents[index % accents.length],
    summary: `${title} for ${audience.toLowerCase()}, designed with a ${style} look and a clear commercial story.`,
    slides: slideBlueprints.map(([slideTitle, subtitle, bullets, visual], slideIndex) => ({
      title: slideIndex === 0 ? title : slideTitle,
      subtitle,
      bullets: bullets.map((bullet) => `${bullet} for ${category.toLowerCase()} buyers`),
      visual,
    })),
  };
});

export const onlinePresentationServiceDeckCount = onlinePresentationServiceDecks.length;
