import { AddOnsManager } from '@/components/monetization/add-ons-manager';

export default function AddOnsPage() {
  return (
    <div className="container mx-auto py-6">
      <AddOnsManager 
        businessId="your-business-id" // This should come from auth context
      />
    </div>
  );
}
