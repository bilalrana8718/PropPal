import React from 'react';
import { Calendar, MapPin, Clock, X, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Visit {
    _id: string;
    property_id?: string;
    property_details?: {
        title: string;
        location: string;
        price: number;
        image?: string;
    };
    seller_details?: {
        name: string;
        email: string;
        phone: string;
    };
    confirmed_time?: string;
    confirmed_time_readable?: string;
    status: 'confirmed' | 'pending_seller_response' | 'pending_buyer_confirmation' | 'rejected' | 'cancelled';
    proposed_time_slots?: string[];
    created_at: string;
}

interface BookingCardProps {
    visit: Visit;
    userType: 'buyer' | 'seller';
    onCancel?: (visitId: string) => void;
    onAccept?: (visitId: string) => void;
    onReject?: (visitId: string) => void;
}

const BookingCard: React.FC<BookingCardProps> = ({ visit, userType, onCancel, onAccept, onReject }) => {
    const getStatusBadge = (status: string) => {
        const badges = {
            confirmed: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle, label: 'Confirmed' },
            pending_seller_response: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: 'Pending Seller' },
            pending_buyer_confirmation: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Clock, label: 'Pending Your Response' },
            rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle, label: 'Rejected' },
            cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', icon: X, label: 'Cancelled' },
        };

        const badge = badges[status as keyof typeof badges] || badges.confirmed;
        const Icon = badge.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
                <Icon className="w-4 h-4" />
                {badge.label}
            </span>
        );
    };

    const formatTime = (isoString?: string) => {
        if (!isoString) return 'Time not set';
        try {
            const date = new Date(isoString);
            return date.toLocaleString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return isoString;
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden max-w-md">
            {/* Header with Property Image */}
            {visit.property_details?.image && (
                <div className="relative h-32 bg-gray-200">
                    <img
                        src={visit.property_details.image}
                        alt={visit.property_details.title}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Property Title */}
                <div>
                    <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">
                        {visit.property_details?.title || 'Property Visit'}
                    </h3>
                    {visit.property_details?.location && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                            <MapPin className="w-4 h-4" />
                            <span className="line-clamp-1">{visit.property_details.location}</span>
                        </div>
                    )}
                </div>

                {/* Status Badge */}
                <div>
                    {getStatusBadge(visit.status)}
                </div>

                {/* Visit Time */}
                {visit.confirmed_time && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                        <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-blue-900">Scheduled Time</p>
                            <p className="text-sm text-blue-700">
                                {visit.confirmed_time_readable || formatTime(visit.confirmed_time)}
                            </p>
                        </div>
                    </div>
                )}

                {/* Seller/Buyer Details */}
                {userType === 'buyer' && visit.seller_details && (
                    <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Contact Seller</p>
                        <p className="text-sm font-medium text-gray-900">{visit.seller_details.name}</p>
                        {visit.seller_details.phone && (
                            <p className="text-sm text-gray-600">{visit.seller_details.phone}</p>
                        )}
                    </div>
                )}

                {userType === 'seller' && visit.buyer_details && (
                    <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Buyer Information</p>
                        <p className="text-sm font-medium text-gray-900">{visit.buyer_details.name}</p>
                        {visit.buyer_details.phone && (
                            <p className="text-sm text-gray-600">{visit.buyer_details.phone}</p>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                    {userType === 'buyer' && visit.status === 'confirmed' && onCancel && (
                        <button
                            onClick={() => onCancel(visit._id)}
                            className="flex-1 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                        >
                            Cancel Visit
                        </button>
                    )}

                    {userType === 'seller' && visit.status === 'pending_seller_response' && (
                        <>
                            {onAccept && (
                                <button
                                    onClick={() => onAccept(visit._id)}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                >
                                    Accept
                                </button>
                            )}
                            {onReject && (
                                <button
                                    onClick={() => onReject(visit._id)}
                                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                                >
                                    Reject
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Created timestamp */}
                <p className="text-xs text-gray-400 text-center">
                    {formatDistanceToNow(new Date(visit.created_at), { addSuffix: true })}
                </p>
            </div>
        </div>
    );
};

export default BookingCard;
