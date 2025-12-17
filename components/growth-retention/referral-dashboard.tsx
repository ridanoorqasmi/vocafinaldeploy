'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Share2, 
  Users, 
  DollarSign, 
  Copy, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Gift,
  ExternalLink
} from 'lucide-react';

interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  totalCreditsEarnedCents: number;
  pendingCreditsCents: number;
  lastReferralDate?: string;
}

interface RecentReferral {
  id: string;
  referredBusiness: {
    id: string;
    name: string;
    createdAt: string;
  };
  status: 'pending' | 'completed' | 'credited';
  referralCreditCents: number;
  createdAt: string;
}

interface ReferralDashboardProps {
  businessId: string;
}

export function ReferralDashboard({ businessId }: ReferralDashboardProps) {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [recentReferrals, setRecentReferrals] = useState<RecentReferral[]>([]);
  const [referralLink, setReferralLink] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferralData();
  }, [businessId]);

  const fetchReferralData = async () => {
    try {
      setLoading(true);
      const [statsResponse, linkResponse] = await Promise.all([
        fetch(`/api/v1/growth-retention/referrals?businessId=${businessId}`),
        fetch(`/api/v1/growth-retention/referrals/link?businessId=${businessId}`)
      ]);

      if (!statsResponse.ok || !linkResponse.ok) {
        throw new Error('Failed to fetch referral data');
      }

      const statsData = await statsResponse.json();
      const linkData = await linkResponse.json();

      setStats(statsData.stats?.stats);
      setRecentReferrals(statsData.stats?.recentReferrals || []);
      setReferralLink(linkData.referralLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch referral data');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy referral link:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'credited':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'credited':
        return <CheckCircle className="h-4 w-4" />;
      case 'completed':
        return <TrendingUp className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
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
            <Button onClick={fetchReferralData} className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Referral Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Your Referral Link
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              value={referralLink}
              readOnly
              className="flex-1"
            />
            <Button
              onClick={copyReferralLink}
              variant={copied ? "default" : "outline"}
              className={copied ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Share this link with friends and earn credits when they sign up and make their first payment.
          </p>
        </CardContent>
      </Card>

      {/* Referral Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats?.totalReferrals || 0}</div>
                <div className="text-sm text-gray-600">Total Referrals</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats?.successfulReferrals || 0}</div>
                <div className="text-sm text-gray-600">Successful</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  ${((stats?.totalCreditsEarnedCents || 0) / 100).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Credits Earned</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Credits */}
      {(stats?.pendingCreditsCents || 0) > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Pending Credits</h4>
                <p className="text-sm text-gray-600">
                  You have ${((stats.pendingCreditsCents || 0) / 100).toFixed(2)} in pending credits 
                  waiting for referral conditions to be met.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Referrals */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {recentReferrals.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="font-medium mb-2">No Referrals Yet</h3>
              <p className="text-sm">Start sharing your referral link to earn credits!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Users className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">{referral.referredBusiness.name}</h4>
                      <p className="text-sm text-gray-600">
                        Joined {new Date(referral.referredBusiness.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant="outline" 
                      className={getStatusColor(referral.status)}
                    >
                      <span className="flex items-center gap-1">
                        {getStatusIcon(referral.status)}
                        {referral.status}
                      </span>
                    </Badge>
                    <div className="text-right">
                      <div className="font-medium">
                        +${(referral.referralCreditCents / 100).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">Credit</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            How Referrals Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-blue-600">1</span>
              </div>
              <div>
                <h4 className="font-medium">Share Your Link</h4>
                <p className="text-sm text-gray-600">
                  Copy and share your unique referral link with friends and colleagues.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-blue-600">2</span>
              </div>
              <div>
                <h4 className="font-medium">They Sign Up</h4>
                <p className="text-sm text-gray-600">
                  When someone signs up using your link, we track the referral.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-blue-600">3</span>
              </div>
              <div>
                <h4 className="font-medium">Earn Credits</h4>
                <p className="text-sm text-gray-600">
                  Once they make their first payment, you both earn credits!
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
