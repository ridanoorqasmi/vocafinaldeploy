import { BillingInsightsDashboard } from '@/components/monetization/billing-insights-dashboard';

export default function BillingInsightsPage() {
  return (
    <div className="container mx-auto py-6">
      <BillingInsightsDashboard 
        businessId="your-business-id" // This should come from auth context
      />
    </div>
  );
}
