'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  ArrowRight,
  DollarSign,
  Clock,
  Target
} from 'lucide-react';

interface UpgradeRecommendation {
  id: string;
  currentPlanId: string;
  recommendedPlanId: string;
  recommendationReason: string;
  confidenceScore: number;
  potentialRevenueIncreaseCents: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  shownAt?: string;
  dismissedAt?: string;
  acceptedAt?: string;
  rule: {
    ruleName: string;
    ruleDescription: string;
  };
}

interface UpgradeRecommendationsProps {
  businessId: string;
}

export function UpgradeRecommendations({ businessId }: UpgradeRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<UpgradeRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendations();
  }, [businessId]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/growth-retention/upgrades?businessId=${businessId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch upgrade recommendations');
      }

      const data = await response.json();
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendationAction = async (recommendationId: string, action: 'show' | 'dismiss' | 'accept') => {
    try {
      const response = await fetch(
        `/api/v1/growth-retention/upgrades/${recommendationId}/${action}`,
        { method: 'PUT' }
      );

      if (response.ok) {
        await fetchRecommendations();
      }
    } catch (err) {
      console.error(`Error ${action}ing recommendation:`, err);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      case 'high':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
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
            <Button onClick={fetchRecommendations} className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-600">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="font-medium mb-2">No Upgrade Recommendations</h3>
            <p className="text-sm">Your current plan is optimal for your usage patterns.</p>
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
            <TrendingUp className="h-5 w-5" />
            Smart Upgrade Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recommendations.map((recommendation) => (
              <div
                key={recommendation.id}
                className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getUrgencyIcon(recommendation.urgencyLevel)}
                    <h4 className="font-medium">{recommendation.rule.ruleName}</h4>
                    <Badge 
                      variant="outline" 
                      className={getUrgencyColor(recommendation.urgencyLevel)}
                    >
                      {recommendation.urgencyLevel}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {Math.round(recommendation.confidenceScore * 100)}% confidence
                    </span>
                    <Progress 
                      value={recommendation.confidenceScore * 100} 
                      className="w-16 h-2" 
                    />
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  {recommendation.recommendationReason}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      <span>
                        +${(recommendation.potentialRevenueIncreaseCents / 100).toFixed(2)}/year
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>Potential savings</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {recommendation.acceptedAt ? (
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Accepted
                      </Badge>
                    ) : recommendation.dismissedAt ? (
                      <Badge variant="outline" className="text-gray-600 border-gray-200">
                        <X className="h-3 w-3 mr-1" />
                        Dismissed
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRecommendationAction(recommendation.id, 'dismiss')}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleRecommendationAction(recommendation.id, 'accept')}
                        >
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Upgrade Now
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Analytics Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendation Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {recommendations.length}
              </div>
              <div className="text-sm text-gray-600">Active Recommendations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {recommendations.filter(r => r.urgencyLevel === 'high' || r.urgencyLevel === 'critical').length}
              </div>
              <div className="text-sm text-gray-600">High Priority</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                ${(recommendations.reduce((sum, r) => sum + r.potentialRevenueIncreaseCents, 0) / 100).toFixed(0)}
              </div>
              <div className="text-sm text-gray-600">Potential Revenue</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
