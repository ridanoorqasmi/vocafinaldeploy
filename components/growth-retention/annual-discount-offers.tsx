'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  DollarSign, 
  Percent, 
  CheckCircle, 
  X, 
  ArrowRight,
  Clock,
  Gift,
  TrendingUp
} from 'lucide-react';

interface AnnualUpgradeOffer {
  id: string;
  currentPlanId: string;
  offerMessage: string;
  discountPercentage: number;
  savingsAmountCents: number;
  shownAt?: string;
  dismissedAt?: string;
  acceptedAt?: string;
  campaign: {
    campaignName: string;
    discountPercentage: number;
    startDate: string;
    endDate: string;
  };
}

interface AnnualDiscountOffersProps {
  businessId: string;
}

export function AnnualDiscountOffers({ businessId }: AnnualDiscountOffersProps) {
  const [offers, setOffers] = useState<AnnualUpgradeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOffers();
  }, [businessId]);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/growth-retention/annual-discounts/offers?businessId=${businessId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch annual discount offers');
      }

      const data = await response.json();
      setOffers(data.offers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch offers');
    } finally {
      setLoading(false);
    }
  };

  const handleOfferAction = async (offerId: string, action: 'show' | 'dismiss' | 'accept') => {
    try {
      const response = await fetch(
        `/api/v1/growth-retention/annual-discounts/offers/${offerId}/${action}`,
        { method: 'PUT' }
      );

      if (response.ok) {
        await fetchOffers();
      }
    } catch (err) {
      console.error(`Error ${action}ing offer:`, err);
    }
  };

  const getOfferStatus = (offer: AnnualUpgradeOffer) => {
    if (offer.acceptedAt) return 'accepted';
    if (offer.dismissedAt) return 'dismissed';
    return 'active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'dismissed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4" />;
      case 'dismissed':
        return <X className="h-4 w-4" />;
      case 'active':
        return <Gift className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const isOfferExpired = (endDate: string) => {
    return new Date(endDate) < new Date();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Error: {error}</p>
            <Button onClick={fetchOffers} className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (offers.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-600">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="font-medium mb-2">No Annual Discount Offers</h3>
            <p className="text-sm">Check back later for special annual subscription offers.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Annual Discount Offers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {offers.map((offer) => {
              const status = getOfferStatus(offer);
              const isExpired = isOfferExpired(offer.campaign.endDate);

              return (
                <div
                  key={offer.id}
                  className={`p-4 rounded-lg border ${
                    status === 'active' && !isExpired
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-blue-600" />
                      <h4 className="font-medium">{offer.campaign.campaignName}</h4>
                      <Badge 
                        variant="outline" 
                        className={getStatusColor(status)}
                      >
                        <span className="flex items-center gap-1">
                          {getStatusIcon(status)}
                          {status}
                        </span>
                      </Badge>
                      {isExpired && (
                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                          Expired
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {offer.discountPercentage}% OFF
                      </div>
                      <div className="text-sm text-gray-600">Annual Plan</div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">
                    {offer.offerMessage}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        <span>
                          Save ${(offer.savingsAmountCents / 100).toFixed(2)}/year
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Valid until {new Date(offer.campaign.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {status === 'accepted' ? (
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Accepted
                        </Badge>
                      ) : status === 'dismissed' ? (
                        <Badge variant="outline" className="text-gray-600 border-gray-200">
                          <X className="h-3 w-3 mr-1" />
                          Dismissed
                        </Badge>
                      ) : isExpired ? (
                        <Badge variant="outline" className="text-red-600 border-red-200">
                          <Clock className="h-3 w-3 mr-1" />
                          Expired
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOfferAction(offer.id, 'dismiss')}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Dismiss
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleOfferAction(offer.id, 'accept')}
                          >
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Upgrade to Annual
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Benefits of Annual Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Benefits of Annual Plans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Percent className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">Save Money</h4>
                  <p className="text-sm text-gray-600">
                    Get up to 15% off your annual subscription compared to monthly billing.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">No Surprises</h4>
                  <p className="text-sm text-gray-600">
                    Lock in your rate for a full year with no price increases.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Gift className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium">Priority Support</h4>
                  <p className="text-sm text-gray-600">
                    Get priority customer support and faster response times.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium">Advanced Features</h4>
                  <p className="text-sm text-gray-600">
                    Access to beta features and early access to new capabilities.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
