// apps/landing-page/src/components/VariantText.tsx
import { useVariant } from '@/lib/use-variant';
import type { LandingPageVariant } from '@/lib/variants';

interface VariantTextProps {
  variantA: string;
  variantB: string;
  variantC: string;
  variantD: string;
  fallback?: string;
  pageName: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

export function VariantText({
  variantA,
  variantB,
  variantC,
  variantD,
  fallback,
  pageName,
  className,
  as: Component = 'span',
}: VariantTextProps) {
  const { variant, loading } = useVariant(pageName);

  if (loading) {
    return <Component className={className}>{fallback || variantA}</Component>;
  }

  const textMap: Record<Exclude<LandingPageVariant, null>, string> = {
    'variant-a': variantA,
    'variant-b': variantB,
    'variant-c': variantC,
    'variant-d': variantD,
  };

  const text = variant ? textMap[variant] : fallback || variantA;

  return <Component className={className}>{text}</Component>;
}
