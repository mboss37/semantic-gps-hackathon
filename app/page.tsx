import { Suspense } from 'react';

import { CtaSection } from '@/components/landing/cta-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { FooterSection } from '@/components/landing/footer-section';
import { HeroSection } from '@/components/landing/hero-section';
import { InfrastructureSection } from '@/components/landing/infrastructure-section';
import { IntegrationsSection } from '@/components/landing/integrations-section';
import { Navigation } from '@/components/landing/navigation';
import { SecuritySection } from '@/components/landing/security-section';
import { StatStrip } from '@/components/landing/stat-strip';

import { VerifiedHandler } from './verified-handler';

export const metadata = {
  title: 'Semantic GPS — Governance gateway for production AI agents',
  description:
    'Semantic GPS sits between AI agents and MCP-connected business systems with policy management, audit logs, monitoring, and Tool Relationship mapping.',
};

const Home = () => (
  <main className="noise-overlay relative min-h-screen overflow-x-hidden bg-[#02040a] text-white">
    <Suspense fallback={null}>
      <VerifiedHandler />
    </Suspense>
    <Navigation />
    <HeroSection />
    <StatStrip />
    <FeaturesSection />
    <InfrastructureSection />
    <IntegrationsSection />
    <SecuritySection />
    <CtaSection />
    <FooterSection />
  </main>
);

export default Home;
