import { Suspense } from 'react';

import { CtaSection } from '@/components/landing/cta-section';
import { DemoVideoSection } from '@/components/landing/demo-video-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { FooterSection } from '@/components/landing/footer-section';
import { HeroSection } from '@/components/landing/hero-section';
import { HowItWorksSection } from '@/components/landing/how-it-works-section';
import { InfrastructureSection } from '@/components/landing/infrastructure-section';
import { IntegrationsSection } from '@/components/landing/integrations-section';
import { Navigation } from '@/components/landing/navigation';
import { SecuritySection } from '@/components/landing/security-section';
import { StatStrip } from '@/components/landing/stat-strip';

import { VerifiedHandler } from './verified-handler';

export const metadata = {
  title: 'Semantic GPS — The control plane for MCP agents',
  description:
    'A gateway that sits between the agent and real tools, redacting data, blocking calls, and rolling back broken workflows.',
};

const Home = () => (
  <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden noise-overlay">
    <Suspense fallback={null}>
      <VerifiedHandler />
    </Suspense>
    <Navigation />
    <HeroSection />
    <StatStrip />
    <DemoVideoSection />
    <FeaturesSection />
    <HowItWorksSection />
    <InfrastructureSection />
    <IntegrationsSection />
    <SecuritySection />
    <CtaSection />
    <FooterSection />
  </main>
);

export default Home;
