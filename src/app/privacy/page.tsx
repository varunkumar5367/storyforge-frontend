import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-zinc-100 font-sans py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="mt-3 text-lg text-zinc-400">
            Last Updated: July 20, 2026
          </p>
        </div>

        {/* Content Box */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 md:p-12 shadow-2xl backdrop-blur-sm space-y-8">
          
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Introduction</h2>
            <p className="text-zinc-300 leading-relaxed text-sm">
              At <strong>StoryForge AI</strong>, we value and respect your privacy. This Privacy Policy documents the types of personal information that is collected and recorded by StoryForge AI and how we use it. If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us.
            </p>
          </section>

          {/* Log Files */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Log Files</h2>
            <p className="text-zinc-300 leading-relaxed text-sm">
              StoryForge AI follows a standard procedure of using log files. These files log visitors when they visit websites. All hosting companies do this and a part of hosting services' analytics. The information collected by log files includes internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable. The purpose of the information is for analyzing trends, administering the site, tracking users' movement on the website, and gathering demographic information.
            </p>
          </section>

          {/* Cookies & Web Beacons */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Cookies and Web Beacons</h2>
            <p className="text-zinc-300 leading-relaxed text-sm">
              Like any other website, StoryForge AI uses &apos;cookies&apos;. These cookies are used to store information including visitors&apos; preferences, and the pages on the website that the visitor accessed or visited. The information is used to optimize the users&apos; experience by customizing our web page content based on visitors&apos; browser type and/or other information.
            </p>
          </section>

          {/* Google DoubleClick DART Cookie */}
          <section className="bg-violet-950/20 border border-violet-800/30 rounded-xl p-6">
            <h2 className="text-xl font-bold text-violet-300 mb-3">4. Google DoubleClick DART Cookie</h2>
            <p className="text-zinc-300 leading-relaxed text-sm mb-4">
              Google is one of the third-party vendors on our site. It also uses cookies, known as DART cookies, to serve ads to our site visitors based upon their visit to www.website.com and other sites on the internet.
            </p>
            <p className="text-zinc-300 leading-relaxed text-sm">
              However, visitors may choose to decline the use of DART cookies by visiting the Google ad and content network Privacy Policy at the following URL:{" "}
              <a 
                href="https://policies.google.com/technologies/ads" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-violet-400 hover:text-violet-300 underline font-medium transition-colors"
              >
                https://policies.google.com/technologies/ads
              </a>
            </p>
          </section>

          {/* Privacy Policies of Ad Partners */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Third-Party Privacy Policies</h2>
            <p className="text-zinc-300 leading-relaxed text-sm">
              You may consult this list to find the Privacy Policy for each of the advertising partners of StoryForge AI. Third-party ad servers or ad networks use technologies like cookies, JavaScript, or Web Beacons that are used in their respective advertisements and links that appear on StoryForge AI, which are sent directly to users&apos; browser. They automatically receive your IP address when this occurs. These technologies are used to measure the effectiveness of their advertising campaigns and/or to personalize the advertising content that you see on websites that you visit.
            </p>
            <p className="text-zinc-300 leading-relaxed text-sm mt-3">
              Note that StoryForge AI has no access to or control over these cookies that are used by third-party advertisers.
            </p>
          </section>

          {/* Consent */}
          <section className="pt-6 border-t border-zinc-800 text-center">
            <h2 className="text-xl font-bold text-white mb-3">Consent</h2>
            <p className="text-zinc-300 leading-relaxed text-sm mb-6">
              By using our website, you hereby consent to our Privacy Policy and agree to its Terms and Conditions.
            </p>
            <Link 
              href="/" 
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
            >
              Back to Dashboard
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
