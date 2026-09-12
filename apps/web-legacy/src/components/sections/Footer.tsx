export default function Footer() {
  return (
    <footer className="bg-navy py-12 md:py-20 px-6 md:px-12 border-t border-white/5">
      <div className="max-w-[1200px] mx-auto">
        {/* ── Desktop footer: full 5-col grid ─────────────────────────────── */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 pb-12 border-b border-white/10">
          
          <div className="lg:col-span-2">
            <img
              src="/logo-flat.png"
              alt="Sweet Sin"
              className="h-20 w-auto rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.4)] mb-4"
            />
            <p className="font-serif text-[14px] italic text-cream/40 mb-6">
              Born in Colombia. Made for Adelaide.<br/>Forgive yourself.
            </p>
            <div className="flex gap-4">
              <SocialIcon icon="Ig" />
              <SocialIcon icon="Tk" />
              <SocialIcon icon="Wa" href="https://wa.me/61433508831" />
            </div>
          </div>
          
          <div>
            <h3 className="font-mono text-[9px] tracking-[0.2em] uppercase text-cream/30 mb-6">Menu</h3>
            <ul className="space-y-3">
              <li><a href="#menu" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">The Seven Sins</a></li>
              <li><a href="#menu" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">The Seven Virtues</a></li>
              <li><a href="#menu" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">La Repolla</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-mono text-[9px] tracking-[0.2em] uppercase text-cream/30 mb-6">Services</h3>
            <ul className="space-y-3">
              <li><a href="#preorder" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">Preorder</a></li>
              <li><a href="#events" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">Event Catering</a></li>
              <li><a href="#events" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">Weddings</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-mono text-[9px] tracking-[0.2em] uppercase text-cream/30 mb-6">Find Us</h3>
            <ul className="space-y-3">
              <li><a href="#story" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">Our Story</a></li>
              <li><a href="#find-us" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">Markets & Schedule</a></li>
              <li><a href="https://wa.me/61433508831" target="_blank" rel="noopener noreferrer" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">WhatsApp</a></li>
            </ul>
          </div>
          
        </div>

        {/* ── Mobile footer: condensed ──────────────────────────────────── */}
        <div className="md:hidden pb-10 border-b border-white/10 flex flex-col items-center text-center gap-6">
          <img
            src="/logo-flat.png"
            alt="Sweet Sin"
            className="h-16 w-auto rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
          />
          <p className="font-serif text-[13px] italic text-cream/40">
            Born in Colombia. Made for Adelaide.<br/>Forgive yourself.
          </p>
          <div className="flex gap-4">
            <SocialIcon icon="Ig" />
            <SocialIcon icon="Tk" />
            <SocialIcon icon="Wa" href="https://wa.me/61433508831" />
          </div>
          <div className="flex gap-6 flex-wrap justify-center">
            <a href="#menu"    className="text-[12px] text-cream/50 hover:text-sin-red transition-colors font-mono uppercase tracking-wider">Menu</a>
            <a href="#events"  className="text-[12px] text-cream/50 hover:text-sin-red transition-colors font-mono uppercase tracking-wider">Events</a>
            <a href="#preorder" className="text-[12px] text-cream/50 hover:text-sin-red transition-colors font-mono uppercase tracking-wider">Order</a>
            <a href="#find-us" className="text-[12px] text-cream/50 hover:text-sin-red transition-colors font-mono uppercase tracking-wider">Find Us</a>
          </div>
        </div>
        
        <div className="pt-8 flex justify-center font-mono text-[10px] text-cream/20 tracking-wider">
          <p>© {new Date().getFullYear()} Sweet Sin · Adelaide SA</p>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ icon, href = '#' }: { icon: string; href?: string }) {
  return (
    <a href={href} target={href !== '#' ? '_blank' : undefined} rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-cream/60 hover:text-white hover:bg-sin-red hover:border-sin-red transition-all">
      <span className="text-[12px] font-bold font-serif">{icon}</span>
    </a>
  );
}
