import { Suspense } from 'react';

import { CtaSection } from '@/components/landing/cta-section';
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
  title: 'Semantic GPS — Govern any MCP before production',
  description:
    'A gateway for customer-owned MCP stacks: sandbox workflows, enforce policies, audit every call, and roll back broken agent actions.',
};

const Home = () => (
  <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden noise-overlay">
    <Suspense fallback={null}>
      <VerifiedHandler />
    </Suspense>
    <Navigation />
    <HeroSection />
    <StatStrip />
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
