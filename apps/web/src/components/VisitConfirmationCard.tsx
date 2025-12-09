'use client'

import { motion } from 'framer-motion'
import {
    CheckCircleIcon,
    CalendarIcon,
    ClockIcon,
    MapPinIcon,
    HomeModernIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid'

interface VisitConfirmationCardProps {
    visitId: string
    propertyName: string
    propertyCity?: string
    confirmedTime: string
    confirmedTimeReadable: string
    status: string
    onCancel?: (visitId: string) => void
}

export default function VisitConfirmationCard({
    visitId,
    propertyName,
    propertyCity,
    confirmedTime,
    confirmedTimeReadable,
    status,
    onCancel,
}: VisitConfirmationCardProps) {
    const isConfirmed = status === 'confirmed'
    const isCancelled = status === 'cancelled'
    const isPending = status === 'pending_seller_response'

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mt-3 overflow-hidden rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg"
        >
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircleSolidIcon className="h-6 w-6 text-white" />
                        <h3 className="text-lg font-bold text-white">
                            {isConfirmed && 'Visit Confirmed! 🎉'}
                            {isPending && 'Visit Request Sent'}
                            {isCancelled && 'Visit Cancelled'}
                        </h3>
                    </div>
                    {isConfirmed && (
                        <div className="rounded-full bg-white/20 px-3 py-1">
                            <span className="text-xs font-semibold text-white">CONFIRMED</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Property Info */}
                <div className="flex items-start gap-3 p-3 bg-white/60 backdrop-blur rounded-lg border border-green-100">
                    <div className="flex-shrink-0 mt-1">
                        <HomeModernIcon className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-600">Property</p>
                        <p className="text-base font-semibold text-slate-900 truncate">{propertyName}</p>
                        {propertyCity && (
                            <div className="flex items-center gap-1 mt-1">
                                <MapPinIcon className="h-4 w-4 text-slate-500" />
                                <p className="text-sm text-slate-600">{propertyCity}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Visit Time */}
                <div className="flex items-start gap-3 p-3 bg-white/60 backdrop-blur rounded-lg border border-green-100">
                    <div className="flex-shrink-0 mt-1">
                        <CalendarIcon className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-slate-600">Scheduled Time</p>
                        <p className="text-base font-semibold text-slate-900">{confirmedTimeReadable}</p>
                    </div>
                </div>

                {/* Visit ID */}
                <div className="p-3 bg-white/40 rounded-lg border border-green-100">
                    <p className="text-xs font-medium text-slate-600 mb-1">Visit ID</p>
                    <p className="text-xs font-mono text-slate-700 break-all">{visitId}</p>
                </div>

                {/* Status Message */}
                {isConfirmed && (
                    <div className="p-3 bg-green-100/50 rounded-lg border border-green-200">
                        <div className="flex items-start gap-2">
                            <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-green-900">
                                    The seller has been notified
                                </p>
                                <p className="text-xs text-green-700 mt-1">
                                    You'll receive a reminder 24 hours before your visit. Please arrive on time!
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {isPending && (
                    <div className="p-3 bg-amber-100/50 rounded-lg border border-amber-200">
                        <div className="flex items-start gap-2">
                            <ClockIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-900">
                                    Waiting for seller confirmation
                                </p>
                                <p className="text-xs text-amber-700 mt-1">
                                    The seller will respond within 24 hours. You'll be notified once they confirm.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cancel Button */}
                {isConfirmed && onCancel && (
                    <button
                        onClick={() => onCancel(visitId)}
                        className="w-full mt-2 px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <XMarkIcon className="h-4 w-4" />
                        Cancel Visit
                    </button>
                )}
            </div>
        </motion.div>
    )
}
