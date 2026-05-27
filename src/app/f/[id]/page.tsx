"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle, ExternalLink } from "lucide-react";

interface FeedbackData {
  id: string;
  status: string;
  tenant: {
    name: string;
    logo: string | null;
    brandPrimaryColor: string;
  };
  reviewRequest?: {
    platform: string;
    url: string;
  };
}

export default function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: token } = use(params);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/feedback/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setFeedback(data);
          if (data.status === "SUBMITTED") {
            setSubmitted(true);
          }
        }
      })
      .catch(() => setError("Unable to load feedback form"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/feedback/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setFeedback(data);
        setSubmitted(true);
      }
    } catch {
      setError("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const brandColor = feedback?.tenant.brandPrimaryColor || "#2563eb";

  if (submitted && feedback) {
    const isPositive = feedback.reviewRequest;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          {feedback.tenant.logo && (
            <img
              src={feedback.tenant.logo}
              alt={feedback.tenant.name}
              className="h-12 mx-auto mb-4"
            />
          )}
          <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: brandColor }} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank you!</h1>
          <p className="text-gray-600 mb-6">
            Your feedback means a lot to {feedback.tenant.name}.
          </p>

          {isPositive && feedback.reviewRequest && (
            <div className="bg-blue-50 rounded-xl p-6 mb-4">
              <p className="text-sm text-gray-700 mb-4">
                We&apos;re glad you had a great experience! Would you mind sharing your honest
                review on {feedback.reviewRequest.platform}? It helps others find us.
              </p>
              <a
                href={feedback.reviewRequest.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition-colors"
                style={{ backgroundColor: brandColor }}
              >
                Leave an Honest Review
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-4">
            Powered by EchoRank
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
        {feedback?.tenant.logo && (
          <img
            src={feedback.tenant.logo}
            alt={feedback.tenant.name}
            className="h-12 mx-auto mb-4"
          />
        )}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          How was your experience?
        </h1>
        <p className="text-gray-500 text-center mb-8">
          {feedback?.tenant.name} would love your honest feedback.
        </p>

        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className="h-12 w-12"
                fill={star <= (hoveredRating || rating) ? "#facc15" : "none"}
                stroke={star <= (hoveredRating || rating) ? "#facc15" : "#d1d5db"}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2 text-center">
              {rating >= 4
                ? "Wonderful! Tell us what you loved."
                : "We're sorry to hear that. How can we improve?"}
            </p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts (optional)..."
              className="resize-none"
              rows={4}
            />
          </div>
        )}

        <Button
          onClick={handleSubmit}
          loading={submitting}
          disabled={rating === 0}
          className="w-full"
          size="lg"
          style={{ backgroundColor: rating > 0 ? brandColor : undefined }}
        >
          Submit Feedback
        </Button>

        <p className="text-xs text-gray-400 text-center mt-6">
          Your feedback is confidential and helps improve service quality.
        </p>
      </div>
    </div>
  );
}
