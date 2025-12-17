import { UsageTracker } from '@/components/monetization/usage-tracker';

export default function UsagePage() {
  return (
    <div className="container mx-auto py-6">
      <UsageTracker 
        businessId="your-business-id" // This should come from auth context
      />
    </div>
  );
}
