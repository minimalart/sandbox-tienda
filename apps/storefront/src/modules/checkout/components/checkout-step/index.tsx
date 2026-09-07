"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";

type CheckoutStepProps = {
  stepNumber: number;
  title: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  isCompleted: boolean;
  isEditing?: boolean;
  completedSummary?: React.ReactNode;
  onEdit?: () => void;
  children: React.ReactNode;
};

function getStepBadgeClass(
  isCompleted: boolean,
  isOpen: boolean,
  isEditing: boolean,
) {
  if (isEditing) {
    return "bg-[--warning-color] text-white";
  }
  if (isCompleted) {
    return "bg-[--success-color] text-white";
  }
  if (isOpen) {
    return "bg-[--primary-color] text-white";
  }
  return "bg-[--badge-bg] text-[--icon-muted]";
}

function getStepShadowClass(
  isOpen: boolean,
  _isCompleted: boolean,
  isEditing: boolean,
) {
  if (isEditing) {
    return "bg-white shadow-sm border border-[--warning-color]";
  }
  if (isOpen) {
    return "bg-white shadow-sm border border-[--primary-color]";
  }
  return "bg-white shadow-sm border border-transparent";
}

export default function CheckoutStep({
  stepNumber,
  title,
  icon,
  isOpen,
  isCompleted,
  isEditing = false,
  onEdit,
  children,
}: CheckoutStepProps) {
  const isToggleable = isCompleted && !isOpen && !!onEdit;

  const HeaderContent = (
    <>
      {/* Step number or check */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-semibold text-sm ${getStepBadgeClass(
          isCompleted,
          isOpen,
          isEditing,
        )}`}
      >
        {isEditing ? (
          <PencilSquareIcon className="h-4 w-4" />
        ) : isCompleted ? (
          <CheckIcon className="h-4 w-4" />
        ) : (
          stepNumber
        )}
      </div>

      {/* Icon + Title (+ optional pill / hint) */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          {icon && (
            <span className="shrink-0 text-[--icon-muted] [&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_svg]:h-4 sm:[&_svg]:w-4">
              {icon}
            </span>
          )}
          <span
            className={`shrink-0 font-semibold text-sm sm:text-base ${
              isOpen || isCompleted || isEditing
                ? "text-[--text-dark]"
                : "text-[--icon-muted]"
            }`}
          >
            {title}
          </span>
          {isEditing && (
            <span className="ml-0.5 inline-flex shrink-0 items-center rounded-full bg-[--warning-bg] px-2 py-0.5 font-medium text-[10px] text-[--warning-color] sm:ml-1 sm:px-2.5 sm:text-xs">
              Editando
            </span>
          )}
          {isCompleted && !isOpen && !isEditing && (
            <span className="ml-0.5 inline-flex shrink-0 items-center rounded-full bg-[--success-bg] px-2 py-0.5 font-medium text-[10px] text-[--success-color] sm:ml-1 sm:px-2.5 sm:text-xs">
              Completado
            </span>
          )}
        </div>
        {!(isOpen || isCompleted || isEditing) && (
          <span className="text-[--icon-muted] text-[10px] sm:text-xs">
            Completá el paso anterior para continuar.
          </span>
        )}
      </div>

      <ChevronDownIcon
        className={`h-4 w-4 shrink-0 text-[--chevron-color] transition-transform duration-200 sm:h-5 sm:w-5 ${
          isOpen ? "rotate-180" : ""
        }`}
      />
    </>
  );

  return (
    <div
      className={`rounded-xl transition-shadow ${getStepShadowClass(
        isOpen,
        isCompleted,
        isEditing,
      )}`}
    >
      {/* Header — clickable when completed to re-edit */}
      {isToggleable ? (
        <button
          className="group flex w-full items-center gap-2 px-4 py-3 sm:gap-3 sm:px-5 sm:py-4 text-left"
          onClick={onEdit}
          type="button"
        >
          {HeaderContent}
        </button>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-5 sm:py-4">{HeaderContent}</div>
      )}

      {/* Body */}
      {isOpen && <div className="px-5 py-5">{children}</div>}
    </div>
  );
}
