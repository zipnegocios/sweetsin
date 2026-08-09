import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

import CustomCursor from './components/ui/CustomCursor';
import Navbar from './components/layout/Navbar';
import MobileNav from './components/layout/MobileNav';
import CartBar from './components/ui/CartBar';
import { CartProvider } from './lib/cart';

import Hero from './components/sections/Hero';
import Marquee from './components/sections/Marquee';
import BrandStory from './components/sections/BrandStory';
import Menu from './components/sections/Menu';
import Spotlight from './components/sections/Spotlight';
import Events from './components/sections/Events';
import Preorder from './components/sections/Preorder';
import FindUs from './components/sections/FindUs';
import Footer from './components/sections/Footer';

const queryClient = new QueryClient();

function Home() {
  return (
    <CartProvider>
      <main className="w-full min-h-screen bg-sweet-dark text-cream selection:bg-sin-red selection:text-white pb-14 md:pb-0">
        <CustomCursor />
        <Navbar />

        <Hero />
        <Marquee />
        <BrandStory />
        <Menu />
        <Spotlight />
        <Events />
        <Preorder />
        <FindUs />
        <Footer />

        <MobileNav />
        <CartBar />
      </main>
    </CartProvider>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
