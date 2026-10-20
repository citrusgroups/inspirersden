"use client";
/* Supplied brand assets use their original files. */
/* eslint-disable @next/next/no-img-element */
import { readJson } from "@/lib/json";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Menu,
    X,
    Camera as Instagram,
    Mail,
    Phone,
    Check,
    Users,
    Clapperboard,
    MessagesSquare,
    ChartNoAxesCombined,
    Plus,
} from "lucide-react";
import { creators, initialPackages } from "@/lib/seed";
import { categories } from "@/lib/types";
export function PublicHeader() {
    const [open, setOpen] = useState(false),
        [logo, setLogo] = useState("/brand/logo.png");
    useEffect(() => {
        fetch("/api/branding")
            .then(readJson)
            .then((data) => {
                if (data.logo) setLogo(data.logo);
            })
            .catch(() => null);
    }, []);
    return (
        <header className="public-header">
            <Link href="/" className="brand-lockup">
                <img
                    src={logo}
                    alt="Official Inspirers’ Den logo"
                    onError={() => setLogo("/brand/logo.png")}
                />
                <span>
                    INSPIRERS’ DEN<small>INFLUENCE, WITH INTENTION.</small>
                </span>
            </Link>
            <button
                className="mobile-toggle"
                aria-label="Toggle navigation"
                onClick={() => setOpen(!open)}
            >
                {open ? <X /> : <Menu />}
            </button>
            <nav className={open ? "open" : ""}>
                <Link href="/">Home</Link>
                <Link href="/about">About us</Link>
                <Link href="/#creators">Our creators</Link>
                <Link href="/#services">Services</Link>
                <Link href="/contact">Let’s talk</Link>
                <Link href="/dashboard" className="nav-portal">
                    Agency portal
                </Link>
            </nav>
        </header>
    );
}
export function PublicFooter() {
    return (
        <footer className="public-footer">
            <div>
                <img src="/brand/logo.png" alt="Inspirers’ Den" />
                <h3>
                    Good stories deserve
                    <br />
                    the right audience.
                </h3>
            </div>
            <div>
                <strong>Find your way</strong>
                <Link href="/about">About the agency</Link>
                <Link href="/#creators">Meet our creators</Link>
                <Link href="/contact?type=Influencer%20application">
                    Join the network
                </Link>
                <Link href="/dashboard">Agency portal</Link>
            </div>
            <div>
                <strong>Start a conversation</strong>
                <a href="mailto:inspirersden@gmail.com">inspirersden@gmail.com</a>
                <a href="tel:+923218847959">+92 321 8847959</a>
                <a
                    href="https://www.instagram.com/inspirersden/"
                    target="_blank"
                    rel="noreferrer"
                >
                    Instagram @inspirersden
                </a>
                <Link href="/contact">Brand collaborations</Link>
            </div>
            <div className="footer-bottom">
                <span>© {new Date().getFullYear()} Inspirers’ Den</span>
                <span>Built around people. Driven by creativity.</span>
            </div>
        </footer>
    );
}
export function Home() {
    const [category, setCategory] = useState("All creators"),
        [roster, setRoster] = useState<typeof creators>(creators),
        [rosterLoaded, setRosterLoaded] = useState(false);
    useEffect(() => {
        fetch("/api/creators")
            .then((r) => readJson(r))
            .then((data) => {
                if (Array.isArray(data.creators) && data.creators.length) {
                    setRoster(data.creators);
                } else {
                    setRoster(creators);
                }
            })
            .catch(() => setRoster(creators))
            .finally(() => setRosterLoaded(true));
    }, []);
    const list = roster.filter(
        (c) => category === "All creators" || c.niche === category,
    );
    return (
        <>
            <PublicHeader />
            <main>
                <section className="hero">
                    <div className="hero-copy">
                        <div className="eyebrow">
                            <span /> INFLUENCER MARKETING & PR
                        </div>
                        <h1>
                            Real voices.
                            <br />
                            Meaningful
                            <br />
                            <em>connections.</em>
                        </h1>
                        <p>
                            We bring brands and creators together to tell stories that people
                            connect with.
                        </p>
                        <div className="hero-actions">
                            <Link
                                className="btn gold"
                                href="/contact?type=Brand%20collaboration"
                            >
                                Work with our influencers
                            </Link>
                            <Link
                                className="text-link"
                                href="/contact?type=Influencer%20application"
                            >
                                Join our network
                            </Link>
                        </div>
                        <div className="hero-note">
                            <span className="tiny-avatars">
                                {roster.slice(0, 3).map((c) => (
                                    <img
                                        key={String(c.name)}
                                        src={String(c.image || "/brand/plans.jpg")}
                                        alt=""
                                        onError={(event) => {
                                            event.currentTarget.src = "/brand/plans.jpg";
                                        }}
                                    />
                                ))}
                            </span>
                            <span>Creative voices. One connected network.</span>
                        </div>
                    </div>
                    <div className="hero-art">
                        <div className="art-label">THE PEOPLE BEHIND THE INFLUENCE</div>
                        {roster[1] && (
                            <div className="hero-photo main-photo">
                                <img
                                    src={String(roster[1].image || "/brand/plans.jpg")}
                                    alt={String(roster[1].name)}
                                    onError={(event) => {
                                        event.currentTarget.src = "/brand/plans.jpg";
                                    }}
                                />
                                <div>
                                    <small>{roster[1].niche}</small>
                                    <strong>{roster[1].name}</strong>
                                </div>
                            </div>
                        )}
                        {roster[0] && (
                            <div className="hero-photo secondary-photo">
                                <img
                                    src={String(roster[0].image || "/brand/plans.jpg")}
                                    alt={String(roster[0].name)}
                                    onError={(event) => {
                                        event.currentTarget.src = "/brand/plans.jpg";
                                    }}
                                />
                                <div>
                                    <small>{roster[0].niche}</small>
                                    <strong>{roster[0].name}</strong>
                                </div>
                            </div>
                        )}
                        <div className="creative-stamp">
                            <Clapperboard />
                            <span>
                                People first.
                                <br />
                                <b>Stories always.</b>
                            </span>
                        </div>
                        <div className="art-caption">A NETWORK OF DISTINCTIVE VOICES</div>
                    </div>
                </section>
                <div className="category-ribbon">
                    {categories.map((c, i) => (
                        <span key={c}>
                            {c}
                            <span className="ribbon-cross">✦</span>
                            {i === 5 ? "" : ""}
                        </span>
                    ))}
                </div>
                <section className="public-section intro">
                    <span className="eyebrow dark">WELCOME TO THE DEN</span>
                    <h2>
                        We connect the dots.
                        <br />
                        Creators bring them <em>to life.</em>
                    </h2>
                    <div>
                        <p>
                            At Inspirers’ Den, we believe influence starts with trust. We help
                            brands find voices that fit their story, and give creators the
                            support to do their best work.
                        </p>
                        <Link className="btn outline" href="/about">
                            Get to know us
                        </Link>
                    </div>
                </section>
                <section className="public-section roster" id="creators">
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow dark">OUR CREATIVE NETWORK</span>
                            <h2>
                                Meet your next
                                <br />
                                <em>collaborator.</em>
                            </h2>
                        </div>
                        <p>
                            Food lovers, visual storytellers and everyday inspiration.
                            Discover a voice that feels right for your brand.
                        </p>
                    </div>
                    <div className="category-tabs">
                        {["All creators", ...categories].map((c) => (
                            <button
                                key={c}
                                onClick={() => setCategory(c)}
                                className={category === c ? "active" : ""}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                    <div className="creator-grid">
                        {list.map((c) => (
                            <Link
                                key={String(c.name)}
                                href={
                                    "/contact?type=Brand%20collaboration&creator=" +
                                    encodeURIComponent(String(c.name))
                                }
                                className="creator-card"
                            >
                                <div className="creator-photo">
                                    <img
                                        src={String(c.image || "/brand/plans.jpg")}
                                        alt={String(c.name)}
                                        onError={(event) => {
                                            event.currentTarget.src = "/brand/plans.jpg";
                                        }}
                                    />
                                    <span>{c.niche}</span>
                                </div>
                                <div className="creator-info">
                                    <h3>{c.name}</h3>
                                    <p>{c.handle}</p>
                                    <div>
                                        <span>{c.platform}</span>
                                        <b>Explore collaboration</b>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                    {rosterLoaded && list.length === 0 && (
                        <div className="public-empty">
                            We’re expanding this category.{" "}
                            <Link href="/contact">Tell us who you’re looking for.</Link>
                        </div>
                    )}
                    <p className="caption">
                        Creator information is based on the supplied media kits.
                        Availability, rates and audience figures are confirmed before
                        booking.
                    </p>
                </section>
                <section className="services-section" id="services">
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow">WHAT WE DO</span>
                            <h2>
                                From the first idea
                                <br />
                                to the <em>final impression.</em>
                            </h2>
                        </div>
                        <Link className="btn gold" href="/contact">
                            Let’s build something
                        </Link>
                    </div>
                    <div className="service-grid">
                        {[
                            [
                                Users,
                                "Influencer marketing",
                                "The right creators, a clear brief and collaborations that feel natural.",
                            ],
                            [
                                MessagesSquare,
                                "Public relations",
                                "Thoughtful stories and relationships that help your brand find its voice.",
                            ],
                            [
                                Clapperboard,
                                "Content & campaigns",
                                "Creative direction, coordinated deliverables and a consistent brand story.",
                            ],
                            [
                                ChartNoAxesCombined,
                                "Social media management",
                                "Content calendars, community presence and performance reporting.",
                            ],
                        ].map(([Icon, title, copy], i) => {
                            const I = Icon as typeof Users;
                            return (
                                <div className="service-card" key={String(title)}>
                                    <div>
                                        <I />
                                        <span>0{i + 1}</span>
                                    </div>
                                    <h3>{String(title)}</h3>
                                    <p>{String(copy)}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>
                <section className="public-section process">
                    <span className="eyebrow dark">A CLEAR PATH TO COLLABORATION</span>
                    <h2>
                        Great work starts
                        <br />
                        with a <em>conversation.</em>
                    </h2>
                    <div className="process-grid">
                        {[
                            [
                                "01",
                                "Tell us your story",
                                "Share your goals, audience, timeline and budget.",
                            ],
                            [
                                "02",
                                "Find the right fit",
                                "We shortlist creators and agree on the right deliverables.",
                            ],
                            [
                                "03",
                                "Create, together",
                                "Briefs, content approvals and deadlines stay coordinated.",
                            ],
                            [
                                "04",
                                "See the impact",
                                "Review deliverables and the results available for your campaign.",
                            ],
                        ].map(([n, t, p]) => (
                            <div key={n}>
                                <span>{n}</span>
                                <h3>{t}</h3>
                                <p>{p}</p>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="public-section plans">
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow dark">SOCIAL MEDIA PACKAGES</span>
                            <h2>
                                Your brand.
                                <br />
                                <em>A consistent presence.</em>
                            </h2>
                        </div>
                        <p>
                            Monthly plans from the agency’s supplied service material. Choose
                            a starting point; we’ll confirm the scope together.
                        </p>
                    </div>
                    <div className="plan-grid">
                        {initialPackages.map((p, i) => (
                            <article
                                className={"plan " + (i === 2 ? "featured-plan" : "")}
                                key={String(p.name)}
                            >
                                <span className="eyebrow dark">
                                    {i === 2 ? "FULL SOCIAL PRESENCE" : "MONTHLY MANAGEMENT"}
                                </span>
                                <h3>{p.name}</h3>
                                <div className="price">
                                    {Number(p.price).toLocaleString()}
                                    <small> PKR / month</small>
                                </div>
                                <p>{String(p.deliverables).split("\n")[0]}</p>
                                <ul>
                                    {String(p.deliverables)
                                        .split("\n")
                                        .slice(1)
                                        .map((s) => (
                                            <li key={s}>
                                                <Check size={16} />
                                                {s}
                                            </li>
                                        ))}
                                </ul>
                                <Link
                                    className={"btn " + (i === 2 ? "gold" : "outline")}
                                    href={"/contact?package=" + p.name}
                                >
                                    Discuss {p.name}
                                </Link>
                            </article>
                        ))}
                    </div>
                    <p className="caption">
                        Service fees only. Advertising spend and influencer fees are
                        additional. Pricing is subject to confirmation.
                    </p>
                </section>
                {roster.some((c) => c.name === "Ali E.") && (
                    <section className="public-section showcase">
                        <div>
                            <span className="eyebrow dark">STORIES IN FOCUS</span>
                            <h2>
                                A different perspective.
                                <br />
                                <em>A memorable story.</em>
                            </h2>
                            <p>
                                Explore Ali E.’s visual storytelling and travel content in the
                                supplied creator portfolio.
                            </p>
                            <a
                                className="btn outline"
                                href="/brand/ali.pdf"
                                target="_blank"
                                rel="noreferrer"
                            >
                                View creator portfolio
                            </a>
                        </div>
                        <img src="/brand/ali.jpg" alt="Ali E. travel creator portfolio" />
                    </section>
                )}
                <section className="public-section faq">
                    <div>
                        <span className="eyebrow dark">LET’S MAKE IT CLEAR</span>
                        <h2>
                            A few things
                            <br />
                            you might <em>be wondering.</em>
                        </h2>
                        <div className="testimonial-note">
                            <MessagesSquare />
                            <p>
                                Client stories will appear here once approved testimonials are
                                available.
                            </p>
                        </div>
                    </div>
                    <div>
                        {[
                            [
                                "How do I choose the right influencer?",
                                "Tell us your campaign goals and audience. We review category, content style, budget and availability to shortlist the right creators.",
                            ],
                            [
                                "Can I join the creator network?",
                                "Yes. Submit an influencer application with your social links and a little about your content. Our team will review it and follow up.",
                            ],
                            [
                                "Are the package prices all-inclusive?",
                                "Monthly management fees exclude advertising spend and influencer fees. A final proposal will explain the agreed scope and costs.",
                            ],
                            [
                                "How do campaign approvals work?",
                                "We agree on a brief, deliverables and deadlines first. Content is reviewed against the brief before publishing.",
                            ],
                            [
                                "Where can I view media kits?",
                                "Ask our team for the relevant creator media kit or access uploaded kits through the agency portal.",
                            ],
                        ].map(([q, a]) => (
                            <details key={q}>
                                <summary>
                                    {q}
                                    <Plus size={18} />
                                </summary>
                                <p>{a}</p>
                            </details>
                        ))}
                    </div>
                </section>
                <section className="public-cta">
                    <span className="eyebrow dark">MAKE YOUR NEXT MOVE</span>
                    <h2>
                        Let’s create a little
                        <br />
                        <em>influence.</em>
                    </h2>
                    <Link className="btn charcoal" href="/contact">
                        Start a conversation
                    </Link>
                </section>
            </main>
            <PublicFooter />
        </>
    );
}
export function About() {
    return (
        <>
            <PublicHeader />
            <main>
                <section className="about-hero">
                    <span className="eyebrow">THE AGENCY BEHIND THE CONNECTION</span>
                    <h1>
                        A den for creators.
                        <br />A partner for <em>brands.</em>
                    </h1>
                    <p>
                        Inspirers’ Den brings influencer marketing, public relations and
                        social media management together around one idea: meaningful
                        connections.
                    </p>
                </section>
                <section className="public-section intro">
                    <span className="eyebrow dark">OUR PURPOSE</span>
                    <h2>
                        Make influence
                        <br />
                        <em>more human.</em>
                    </h2>
                    <div>
                        <p>
                            Our mission is to connect brands with relevant creative voices and
                            support collaborations through clear briefs, reliable coordination
                            and thoughtful content.
                        </p>
                        <p>
                            Our vision is a network where creators can grow, brands can
                            communicate with confidence and audiences can discover stories
                            that matter to them.
                        </p>
                    </div>
                </section>
                <section className="public-section">
                    <div className="section-heading">
                        <h2>
                            Different voices.
                            <br />
                            <em>Shared values.</em>
                        </h2>
                        <p>
                            Our supplied creator network spans food, travel and lifestyle,
                            with room for new voices in fashion, recipes and entertainment.
                        </p>
                    </div>
                    <div className="process-grid">
                        {[
                            ["01", "Authenticity", "Creators should sound like themselves."],
                            ["02", "Clarity", "Scope, rates and deadlines agreed upfront."],
                            [
                                "03",
                                "Respect",
                                "Thoughtful relationships with creators and clients.",
                            ],
                            [
                                "04",
                                "Accountability",
                                "Visible deliverables and honest reporting.",
                            ],
                        ].map(([n, t, p]) => (
                            <div key={n}>
                                <span>{n}</span>
                                <h3>{t}</h3>
                                <p>{p}</p>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="public-cta">
                    <h2>
                        Find your place
                        <br />
                        <em>in the den.</em>
                    </h2>
                    <div className="hero-actions">
                        <Link
                            className="btn charcoal"
                            href="/contact?type=Brand%20collaboration"
                        >
                            I’m a brand
                        </Link>
                        <Link
                            className="btn outline"
                            href="/contact?type=Influencer%20application"
                        >
                            I’m a creator
                        </Link>
                    </div>
                </section>
            </main>
            <PublicFooter />
        </>
    );
}
export function Contact() {
    const [type, setType] = useState("Brand collaboration");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [success, setSuccess] = useState(false);
    const [draft, setDraft] = useState("");
    useEffect(() => {
        queueMicrotask(() => {
            const params = new URLSearchParams(window.location.search);
            const inquiry = params.get("type");
            if (
                inquiry &&
                [
                    "Brand collaboration",
                    "Influencer application",
                    "General inquiry",
                ].includes(inquiry)
            )
                setType(inquiry);
            const creator = params.get("creator");
            const pack = params.get("package");
            if (creator)
                setDraft(
                    "I would like to discuss a collaboration with " + creator + ". ",
                );
            else if (pack)
                setDraft("I would like to discuss the " + pack + " monthly package. ");
        });
    }, []);
    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setMessage("");
        try {
            const data = Object.fromEntries(new FormData(form));
            const r = await fetch("/api/inquiry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, type }),
            });
            const result = await readJson(r);
            if (!r.ok) throw new Error(result.error);
            setMessage(result.message);
            setSuccess(true);
            setDraft("");
            form.reset();
        } catch (e) {
            setMessage((e as Error).message);
            setSuccess(false);
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <PublicHeader />
            <main className="contact-layout">
                <div className="contact-copy">
                    <span className="eyebrow dark">SAY HELLO</span>
                    <h1>
                        Good things
                        <br />
                        start <em>here.</em>
                    </h1>
                    <p>
                        A campaign idea, a creative partnership, or simply a question. We’d
                        love to hear from you.
                    </p>
                    <a href="mailto:inspirersden@gmail.com">
                        <Mail />
                        inspirersden@gmail.com
                    </a>
                    <a href="tel:+923218847959">
                        <Phone />
                        +92 321 8847959
                    </a>
                    <a
                        href="https://www.instagram.com/inspirersden/"
                        target="_blank"
                        rel="noreferrer"
                    >
                        <Instagram />
                        @inspirersden
                    </a>
                    <div className="contact-note">
                        Tell us what you have in mind.
                        <br />
                        We’ll help you find the right next step.
                    </div>
                </div>
                <form className="contact-form" onSubmit={submit}>
                    <h2>Let’s talk.</h2>
                    <div className="inquiry-tabs">
                        {[
                            "Brand collaboration",
                            "Influencer application",
                            "General inquiry",
                        ].map((t) => (
                            <button
                                type="button"
                                key={t}
                                className={type === t ? "active" : ""}
                                onClick={() => setType(t)}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <div className="form-grid">
                        <label>
                            Your name
                            <input
                                name="name"
                                required
                                minLength={2}
                                maxLength={100}
                                autoComplete="name"
                                placeholder="Full name"
                            />
                        </label>
                        <label>
                            Company / brand
                            <input
                                name="company"
                                placeholder="Company name"
                                maxLength={200}
                            />
                        </label>
                        <label>
                            Email address
                            <input
                                type="email"
                                name="email"
                                required
                                placeholder="you@company.com"
                                autoComplete="email"
                            />
                        </label>
                        <label>
                            Phone number
                            <input
                                type="tel"
                                name="phone"
                                required
                                minLength={7}
                                maxLength={40}
                                placeholder="+92 …"
                                autoComplete="tel"
                            />
                        </label>
                        <label className="full">
                            Budget range
                            <select name="budget">
                                <option>Not decided yet</option>
                                <option>Under PKR 100,000</option>
                                <option>PKR 100,000 – 300,000</option>
                                <option>PKR 300,000 – 1,000,000</option>
                                <option>PKR 1,000,000+</option>
                            </select>
                        </label>
                        <label className="full">
                            What do you have in mind?
                            <textarea
                                name="message"
                                required
                                minLength={10}
                                maxLength={5000}
                                rows={5}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder={
                                    type === "Influencer application"
                                        ? "Tell us about your content and include your social profile links."
                                        : "Your goals, timeline and a little about your project…"
                                }
                            />
                        </label>
                        <input
                            name="website"
                            className="honeypot"
                            tabIndex={-1}
                            autoComplete="off"
                            aria-hidden="true"
                        />
                    </div>
                    {message && (
                        <p
                            className={"form-message " + (success ? "success" : "error")}
                            role="status"
                        >
                            {message}
                        </p>
                    )}
                    <button className="btn charcoal" disabled={busy}>
                        {busy ? "Sending…" : "Send inquiry"}
                    </button>
                    <p className="caption">
                        Your details are used to respond to this inquiry.
                    </p>
                </form>
            </main>
            <PublicFooter />
        </>
    );
}
