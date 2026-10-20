import type { Data } from "./types";
export const creators: Data[] = [
    {
        name: "Waqas Saleem",
        handle: "Vicky Panda",
        niche: "Food",
        platform: "Facebook",
        followers: 930000,
        rate: 190000,
        currency: "PKR",
        status: "Active",
        location: "Pakistan",
        image: "/brand/waqas.jpg",
        kit: "/brand/waqas.pdf",
        bio: "Food reviews, culinary discoveries and engaging stories for a passionate food-loving audience.",
        deliverables:
            "Package deal. See supplied media kit for platform-specific deliverables.",
        email: "",
        source:
            "Supplied Vicky Panda media kit. Audience and rates are kit snapshots; reconfirm before booking.",
    },
    {
        name: "Taim Alam",
        handle: "Taim Alam",
        niche: "Food",
        platform: "TikTok",
        followers: 2000000,
        rate: 400000,
        currency: "PKR",
        status: "Active",
        location: "Pakistan",
        image: "/brand/taim.jpg",
        kit: "/brand/taim-kit.jpg",
        bio: "Food storyteller and content creator exploring the rich culinary traditions of Pakistan.",
        deliverables: "Reel: PKR 400,000 • Story: PKR 150,000 • Event: PKR 200,000",
        email: "",
        source:
            "Supplied Taim Alam media kit. Figures are a dated snapshot, not live social metrics.",
    },
    {
        name: "Noman Jaffar",
        handle: "@islamabadwala",
        niche: "Lifestyle",
        platform: "Instagram",
        followers: 188000,
        rate: 350000,
        currency: "PKR",
        status: "Active",
        location: "Islamabad, Pakistan",
        image: "/brand/noman.jpg",
        kit: "/brand/noman.pdf",
        bio: "Lifestyle creator offering reels, static posts, stories and event appearances.",
        deliverables:
            "1-minute reel: 350,000 • 5-image post: 150,000 • Story: 30,000 • 3-hour event: 70,000",
        email: "noman.jaffar@icloud.com",
        source:
            "Supplied media kit: 125K Instagram + 63K TikTok. Kit rates valid until 31 October 2026.",
    },
    {
        name: "Ali E.",
        handle: "@aliehtisham",
        niche: "Travel",
        platform: "Instagram",
        followers: 1000000,
        rate: 600000,
        currency: "PKR",
        status: "Active",
        location: "Pakistan",
        image: "/brand/ali.jpg",
        kit: "/brand/ali.pdf",
        bio: "Visual storyteller creating cinematic photography, videography and brand stories across travel and adventure.",
        deliverables:
            "Reel: PKR 600,000 • Stories: PKR 100,000 • Carousel: PKR 300,000",
        email: "",
        source:
            "The archive filename says Asfand; the media kit itself identifies Ali E. Confirm agency representation before booking.",
    },
    {
        name: "Abdul Malik Fareed",
        handle: "Abdul Malik Fareed",
        niche: "Lifestyle",
        platform: "Facebook",
        followers: 12780000,
        rate: 2000,
        currency: "USD",
        status: "Active",
        location: "Saudi Arabia",
        image: "/brand/abdul.jpg",
        kit: "/brand/abdul-kit.jpg",
        bio: "Entrepreneur, consultant and Urdu/Hindi content creator based in Saudi Arabia.",
        deliverables:
            "Basic: USD 2,000 • Standard: USD 3,500 • Premium: USD 3,200 • Gold: USD 5,000. Excluding VAT.",
        email: "",
        source:
            "Supplied media kit. Platform counts total 12.78M; reach claims are not guarantees.",
    },
];
export const initialPackages: Data[] = [
    {
        name: "Silver",
        price: 80000,
        currency: "PKR",
        niche: "All",
        status: "Active",
        deliverables:
            "Facebook & Instagram management\n8 static posts • 10 stories • 1 carousel • 4 reels per month\nContent calendar • Basic SEO • Meta ads management",
        notes:
            "Service charges only. Ad spend and influencer charges are additional.",
        influencerIds: [],
    },
    {
        name: "Gold",
        price: 100000,
        currency: "PKR",
        niche: "All",
        status: "Active",
        deliverables:
            "Facebook, Instagram & TikTok management\n12 static posts • 20 stories • 2 carousels • 4 reels\nContent calendar • Basic SEO • Monthly report • Meta & TikTok ads",
        notes: "Imported from supplied monthly plans. Reconfirm pricing.",
        influencerIds: [],
    },
    {
        name: "Platinum",
        price: 120000,
        currency: "PKR",
        niche: "All",
        status: "Active",
        deliverables:
            "Facebook, Instagram, TikTok & YouTube management\n16 static posts • 30 stories • 4 carousels • 8 reels\nSEO • Content calendar • Performance report • Ad campaign creation • Meta, TikTok & Google ads management",
        notes:
            "Service charges only. Ad spend and influencer charges are additional.",
        influencerIds: [],
    },
];
export const defaultSettings: Data = {
    name: "Inspirers’ Den",
    email: "inspirersden@gmail.com",
    phone: "+92 321 8847959",
    whatsapp: "923218847959",
    instagram: "https://www.instagram.com/inspirersden/",
    website: "",
    logo: "/brand/logo.png",
    notifications: true,
    security: "Verified email required. Team invitations expire in 7 days.",
};
