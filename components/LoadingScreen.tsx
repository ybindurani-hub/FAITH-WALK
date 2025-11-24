import React, { useState, useEffect } from 'react';

const THOUGHTS = [
  "Wait on the Lord; be of good courage, and He shall strengthen your heart.",
  "Faith is the substance of things hoped for, the evidence of things not seen.",
  "The Lord is my shepherd; I shall not want.",
  "Be still, and know that I am God.",
  "I can do all things through Christ who strengthens me.",
  "The joy of the Lord is your strength.",
  "For I know the plans I have for you, plans to prosper you and not to harm you.",
  "Trust in the Lord with all your heart and lean not on your own understanding.",
  "He walks with me and He talks with me, and He tells me I am His own.",
  "Peace I leave with you; my peace I give you.",
  "The steadfast love of the Lord never ceases; his mercies never come to an end.",
  "Cast all your anxiety on Him because He cares for you.",
  "Faith moves mountains.",
  "God is our refuge and strength, an ever-present help in trouble.",
  "Let your light so shine before men.",
  "The fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness.",
  "Draw near to God and He will draw near to you.",
  "As iron sharpens iron, so one person sharpens another.",
  "Where the Spirit of the Lord is, there is freedom.",
  "We walk by faith, not by sight.",
  "My grace is sufficient for you, for my power is made perfect in weakness.",
  "Greater is He that is in you, than he that is in the world.",
  "Do not be afraid, for I am with you.",
  "The Lord will fight for you; you need only to be still.",
  "Let all that you do be done in love.",
  "A merry heart does good like a medicine.",
  "His compassions fail not. They are new every morning.",
  "God is love.",
  "Seek first the kingdom of God and His righteousness.",
  "Blessed are the peacemakers, for they will be called children of God."
];

const LoadingScreen: React.FC = () => {
  const [quote, setQuote] = useState(THOUGHTS[0]);

  useEffect(() => {
    // Pick a random quote on mount
    const random = THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)];
    setQuote(random);
    
    // Optional: Rotate quote every 4 seconds if waiting is long
    const interval = setInterval(() => {
        setQuote(THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
      <div className="mb-8 relative">
        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
        </div>
      </div>
      
      <h3 className="text-xl font-serif text-slate-400 mb-4 italic">Reflecting...</h3>
      
      <div className="max-w-md animate-in slide-in-from-bottom-4 duration-700">
        <p className="text-2xl font-serif font-medium text-slate-800 leading-relaxed">
          "{quote}"
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
