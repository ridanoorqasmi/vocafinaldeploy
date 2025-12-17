'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, ArrowRight, Lightbulb } from 'lucide-react';

interface OnboardingStep {
  stepKey: string;
  stepName: string;
  stepDescription: string;
  orderIndex: number;
  estimatedDurationMinutes: number;
}

interface OnboardingProgress {
  currentStep: string;
  completionPercentage: number;
  stepsCompleted: string[];
  activationEvents: Record<string, any>;
  isCompleted: boolean;
  allSteps: OnboardingStep[];
}

interface OnboardingNudge {
  id: string;
  nudgeType: 'tooltip' | 'banner' | 'email' | 'in_app';
  nudgeContent: {
    title: string;
    message: string;
    cta?: string;
  };
  targetStep: string;
  shownAt?: string;
  dismissedAt?: string;
}

interface OnboardingProgressProps {
  businessId: string;
}

export function OnboardingProgress({ businessId }: OnboardingProgressProps) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [nudges, setNudges] = useState<OnboardingNudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOnboardingData();
  }, [businessId]);

  const fetchOnboardingData = async () => {
    try {
      setLoading(true);
      const [progressResponse, nudgesResponse] = await Promise.all([
        fetch(`/api/v1/growth-retention/onboarding?businessId=${businessId}`),
        fetch(`/api/v1/growth-retention/onboarding/nudges?businessId=${businessId}`)
      ]);

      if (!progressResponse.ok || !nudgesResponse.ok) {
        throw new Error('Failed to fetch onboarding data');
      }

      const progressData = await progressResponse.json();
      const nudgesData = await nudgesResponse.json();

      setProgress(progressData.progress);
      setNudges(nudgesData.nudges);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch onboarding data');
    } finally {
      setLoading(false);
    }
  };

  const handleStepClick = async (stepKey: string) => {
    try {
      const response = await fetch('/api/v1/growth-retention/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          stepKey,
          activationEvents: { clicked: true, timestamp: new Date().toISOString() }
        })
      });

      if (response.ok) {
        await fetchOnboardingData();
      }
    } catch (err) {
      console.error('Error updating step:', err);
    }
  };

  const handleNudgeAction = async (nudgeId: string, action: 'show' | 'dismiss') => {
    try {
      const response = await fetch(
        `/api/v1/growth-retention/onboarding/nudges/${nudgeId}/${action}`,
        { method: 'PUT' }
      );

      if (response.ok) {
        await fetchOnboardingData();
      }
    } catch (err) {
      console.error('Error handling nudge:', err);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-2 bg-gray-200 rounded w-full mb-4"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
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
            <Button onClick={fetchOnboardingData} className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!progress) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p>No onboarding progress found</p>
            <Button onClick={() => handleStepClick('welcome')} className="mt-2">
              Start Onboarding
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Onboarding Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-gray-600">{progress.completionPercentage}%</span>
            </div>
            <Progress value={progress.completionPercentage} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span>Current Step: {progress.currentStep}</span>
              {progress.isCompleted && (
                <Badge variant="success" className="bg-green-100 text-green-800">
                  Completed
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {progress.allSteps.map((step, index) => {
              const isCompleted = progress.stepsCompleted.includes(step.stepKey);
              const isCurrent = step.stepKey === progress.currentStep;
              const isClickable = isCurrent || !progress.isCompleted;

              return (
                <div
                  key={step.stepKey}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isCurrent ? 'border-blue-200 bg-blue-50' : ''
                  } ${isCompleted ? 'border-green-200 bg-green-50' : ''} ${
                    isClickable ? 'cursor-pointer hover:bg-gray-50' : 'opacity-50'
                  }`}
                  onClick={() => isClickable && handleStepClick(step.stepKey)}
                >
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : isCurrent ? (
                      <Circle className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{step.stepName}</h4>
                      <div className="flex items-center gap-2">
                        {isCurrent && (
                          <Badge variant="outline" className="text-blue-600 border-blue-200">
                            Current
                          </Badge>
                        )}
                        {isCompleted && (
                          <Badge variant="outline" className="text-green-600 border-green-200">
                            Completed
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          ~{step.estimatedDurationMinutes}min
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{step.stepDescription}</p>
                  </div>
                  {isClickable && (
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Active Nudges */}
      {nudges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Helpful Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nudges.map((nudge) => (
                <div
                  key={nudge.id}
                  className="p-4 rounded-lg border border-yellow-200 bg-yellow-50"
                >
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-yellow-800">{nudge.nudgeContent.title}</h4>
                      <p className="text-sm text-yellow-700 mt-1">{nudge.nudgeContent.message}</p>
                      {nudge.nudgeContent.cta && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleNudgeAction(nudge.id, 'show')}
                          >
                            {nudge.nudgeContent.cta}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleNudgeAction(nudge.id, 'dismiss')}
                          >
                            Dismiss
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
      )}
    </div>
  );
}
