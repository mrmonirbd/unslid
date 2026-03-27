"""
Organization management endpoints.
- GET  /org                          → list user's orgs
- POST /org                          → create org
- GET  /org/{slug}                   → get org details
- POST /org/{slug}/invite            → invite member (with seat guard)
- GET  /org/{slug}/members           → list members + pending invitations
- DELETE /org/{slug}/members/{uid}   → remove member (send email)
- PATCH /org/{slug}/members/{uid}/role → change member role
- DELETE /org/{slug}/invitations/{token} → cancel pending invitation
- POST /org/{slug}/invitations/{token}/resend → resend invitation
- POST /org/{slug}/transfer-ownership → transfer ownership to another member
- PATCH /org/{slug}/seats            → change seats_purchased
- POST /accept-invite/{token}        → accept invitation (validates email match)
"""

import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from api.auth import get_current_user
from models.sql.user import UserModel
from models.sql.organization import OrganizationModel
from models.sql.org_member import OrgMemberModel, OrgInvitationModel
from services.database import get_async_session
from services.emails import (
    send_org_invite_email,
    send_invite_accepted_email,
    send_member_removed_email,
    send_seat_limit_warning_email,
)

ORG_ROUTER = APIRouter(prefix="/org", tags=["organization"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_org_and_membership(
    slug: str, user_id: int, session: AsyncSession
) -> tuple[OrganizationModel, OrgMemberModel]:
    org = await OrganizationModel.get_by_slug(session, slug)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    result = await session.execute(
        select(OrgMemberModel).where(
            OrgMemberModel.org_id == org.id,
            OrgMemberModel.user_id == user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return org, membership


async def _count_active_members(org_id: int, session: AsyncSession) -> int:
    return await session.scalar(
        select(func.count(OrgMemberModel.id)).where(OrgMemberModel.org_id == org_id)
    ) or 0


async def _count_pending_invites(org_id: int, session: AsyncSession) -> int:
    return await session.scalar(
        select(func.count(OrgInvitationModel.id)).where(
            OrgInvitationModel.org_id == org_id,
            OrgInvitationModel.accepted_at.is_(None),
            OrgInvitationModel.cancelled_at.is_(None),
            OrgInvitationModel.expires_at > datetime.now(timezone.utc),
        )
    ) or 0


# ─── List user's organizations ────────────────────────────────────────────────

@ORG_ROUTER.get("")
async def list_orgs(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(OrgMemberModel).where(OrgMemberModel.user_id == current_user.id)
    )
    memberships = result.scalars().all()
    orgs = []
    for membership in memberships:
        org = await session.get(OrganizationModel, membership.org_id)
        if org and org.is_active:
            orgs.append({
                "id": org.id,
                "name": org.name,
                "slug": org.slug,
                "plan": org.plan,
                "seats_purchased": org.seats_purchased,
                "role": membership.role,
                "joined_at": membership.joined_at.isoformat(),
            })
    return orgs


# ─── Create org ───────────────────────────────────────────────────────────────

class CreateOrgRequest(BaseModel):
    name: str
    seats: int = 2  # minimum 2


def slugify(name: str) -> str:
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:40]


@ORG_ROUTER.post("")
async def create_org(
    body: CreateOrgRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    if body.seats < 2:
        raise HTTPException(status_code=400, detail="Minimum 2 seats required for a team.")

    slug = slugify(body.name)
    existing = await OrganizationModel.get_by_slug(session, slug)
    if existing:
        slug = f"{slug}-{secrets.token_hex(3)}"

    org = OrganizationModel(
        name=body.name.strip(),
        slug=slug,
        plan="team",
        seats_purchased=body.seats,
    )
    session.add(org)
    await session.flush()

    membership = OrgMemberModel(
        org_id=org.id,
        user_id=current_user.id,
        role="owner",
    )
    session.add(membership)
    await session.commit()
    await session.refresh(org)

    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "seats_purchased": org.seats_purchased,
        "role": "owner",
    }


# ─── Get org details ──────────────────────────────────────────────────────────

@ORG_ROUTER.get("/{slug}")
async def get_org(
    slug: str,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    org, membership = await _get_org_and_membership(slug, current_user.id, session)
    active = await _count_active_members(org.id, session)
    pending = await _count_pending_invites(org.id, session)
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "plan": org.plan,
        "seats_purchased": org.seats_purchased,
        "seats_used": active + pending,
        "active_members": active,
        "pending_invites": pending,
        "role": membership.role,
        "storage_used_bytes": org.storage_used_bytes,
        "created_at": org.created_at.isoformat(),
    }


# ─── Members + Pending Invitations ────────────────────────────────────────────

@ORG_ROUTER.get("/{slug}/members")
async def list_members(
    slug: str,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return active members and pending invitations in one call."""
    org, _ = await _get_org_and_membership(slug, current_user.id, session)

    result = await session.execute(
        select(OrgMemberModel).where(OrgMemberModel.org_id == org.id)
    )
    memberships = result.scalars().all()

    members = []
    for m in memberships:
        user = await session.get(UserModel, m.user_id)
        if user:
            members.append({
                "type": "member",
                "user_id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": m.role,
                "status": "active",
                "joined_at": m.joined_at.isoformat(),
            })

    # Pending invitations (not accepted, not cancelled, not expired)
    inv_result = await session.execute(
        select(OrgInvitationModel).where(
            OrgInvitationModel.org_id == org.id,
            OrgInvitationModel.accepted_at.is_(None),
            OrgInvitationModel.cancelled_at.is_(None),
        ).order_by(OrgInvitationModel.created_at.desc())
    )
    invitations = inv_result.scalars().all()
    now = datetime.now(timezone.utc)

    for inv in invitations:
        expires_at_aware = inv.expires_at.replace(tzinfo=timezone.utc) if inv.expires_at.tzinfo is None else inv.expires_at
        if expires_at_aware < now:
            continue
        members.append({
            "type": "invitation",
            "invitation_token": inv.token,
            "email": inv.email,
            "full_name": None,
            "role": inv.role,
            "status": "pending",
            "expires_at": expires_at_aware.isoformat(),
            "expires_soon": (expires_at_aware - now).total_seconds() < 86400,
        })

    return members


# ─── Remove Member ────────────────────────────────────────────────────────────

@ORG_ROUTER.delete("/{slug}/members/{user_id}")
async def remove_member(
    slug: str,
    user_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    org, my_membership = await _get_org_and_membership(slug, current_user.id, session)

    if my_membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can remove members")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself. Transfer ownership first.")

    result = await session.execute(
        select(OrgMemberModel).where(
            OrgMemberModel.org_id == org.id,
            OrgMemberModel.user_id == user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")

    if membership.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the org owner. Transfer ownership first.")

    removed_user = await session.get(UserModel, user_id)
    await session.delete(membership)
    await session.commit()

    if removed_user:
        try:
            await send_member_removed_email(removed_user.email, removed_user.full_name or removed_user.email, org.name)
        except Exception:
            pass

    return {"ok": True}


# ─── Change Member Role ───────────────────────────────────────────────────────

class ChangeMemberRoleRequest(BaseModel):
    role: str  # admin | member


@ORG_ROUTER.patch("/{slug}/members/{user_id}/role")
async def change_member_role(
    slug: str,
    user_id: int,
    body: ChangeMemberRoleRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    org, my_membership = await _get_org_and_membership(slug, current_user.id, session)

    if my_membership.role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can change roles")
    if body.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="role must be 'admin' or 'member'")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    result = await session.execute(
        select(OrgMemberModel).where(
            OrgMemberModel.org_id == org.id,
            OrgMemberModel.user_id == user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")

    membership.role = body.role
    session.add(membership)
    await session.commit()
    return {"ok": True}


# ─── Transfer Ownership ───────────────────────────────────────────────────────

class TransferOwnershipRequest(BaseModel):
    new_owner_user_id: int


@ORG_ROUTER.post("/{slug}/transfer-ownership")
async def transfer_ownership(
    slug: str,
    body: TransferOwnershipRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    org, my_membership = await _get_org_and_membership(slug, current_user.id, session)

    if my_membership.role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can transfer ownership")
    if body.new_owner_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You are already the owner")

    result = await session.execute(
        select(OrgMemberModel).where(
            OrgMemberModel.org_id == org.id,
            OrgMemberModel.user_id == body.new_owner_user_id,
        )
    )
    new_owner_membership = result.scalar_one_or_none()
    if not new_owner_membership:
        raise HTTPException(status_code=404, detail="New owner must already be a member")

    my_membership.role = "admin"
    new_owner_membership.role = "owner"
    session.add(my_membership)
    session.add(new_owner_membership)
    await session.commit()
    return {"ok": True}


# ─── Invite Member ────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: str
    role: str = "member"


@ORG_ROUTER.post("/{slug}/invite")
async def invite_member(
    slug: str,
    body: InviteRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    org, my_membership = await _get_org_and_membership(slug, current_user.id, session)

    if my_membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can invite members")
    if body.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="role must be 'admin' or 'member'")

    email = body.email.lower().strip()

    # Seat guard: active + pending ≥ seats_purchased
    active = await _count_active_members(org.id, session)
    pending = await _count_pending_invites(org.id, session)
    seats_used = active + pending
    if seats_used >= org.seats_purchased:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "seats_full",
                "seats_purchased": org.seats_purchased,
                "seats_used": seats_used,
                "message": f"All {org.seats_purchased} seats are in use. Purchase more seats to invite additional members.",
            },
        )

    # Check if already a member
    already_member = await session.execute(
        select(OrgMemberModel).join(UserModel, OrgMemberModel.user_id == UserModel.id).where(
            OrgMemberModel.org_id == org.id,
            UserModel.email == email,
        )
    )
    if already_member.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This email is already a member of the organization")

    # Cancel any existing pending invitation for this email
    existing_inv = await session.execute(
        select(OrgInvitationModel).where(
            OrgInvitationModel.org_id == org.id,
            OrgInvitationModel.email == email,
            OrgInvitationModel.accepted_at.is_(None),
            OrgInvitationModel.cancelled_at.is_(None),
        )
    )
    old_inv = existing_inv.scalar_one_or_none()
    if old_inv:
        old_inv.cancelled_at = datetime.now(timezone.utc)
        session.add(old_inv)

    token = secrets.token_urlsafe(32)
    invitation = OrgInvitationModel(
        org_id=org.id,
        invited_by_user_id=current_user.id,
        email=email,
        role=body.role,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    session.add(invitation)
    await session.commit()

    await send_org_invite_email(
        to=email,
        inviter_name=current_user.full_name or current_user.email,
        org_name=org.name,
        invite_token=token,
    )

    # Send seat limit warning to owner if now at capacity
    if active + pending + 1 >= org.seats_purchased:
        try:
            owner_result = await session.execute(
                select(UserModel).join(OrgMemberModel, UserModel.id == OrgMemberModel.user_id).where(
                    OrgMemberModel.org_id == org.id,
                    OrgMemberModel.role == "owner",
                )
            )
            owner = owner_result.scalar_one_or_none()
            if owner:
                await send_seat_limit_warning_email(owner.email, owner.full_name or owner.email, org.name, org.seats_purchased)
        except Exception:
            pass

    return {"ok": True, "token": token}


# ─── Cancel Invitation ────────────────────────────────────────────────────────

@ORG_ROUTER.delete("/{slug}/invitations/{token}")
async def cancel_invitation(
    slug: str,
    token: str,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    org, my_membership = await _get_org_and_membership(slug, current_user.id, session)

    if my_membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can cancel invitations")

    result = await session.execute(
        select(OrgInvitationModel).where(
            OrgInvitationModel.token == token,
            OrgInvitationModel.org_id == org.id,
        )
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation.accepted_at:
        raise HTTPException(status_code=400, detail="Cannot cancel an accepted invitation")

    invitation.cancelled_at = datetime.now(timezone.utc)
    session.add(invitation)
    await session.commit()
    return {"ok": True}


# ─── Resend Invitation ────────────────────────────────────────────────────────

@ORG_ROUTER.post("/{slug}/invitations/{token}/resend")
async def resend_invitation(
    slug: str,
    token: str,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    org, my_membership = await _get_org_and_membership(slug, current_user.id, session)

    if my_membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can resend invitations")

    result = await session.execute(
        select(OrgInvitationModel).where(
            OrgInvitationModel.token == token,
            OrgInvitationModel.org_id == org.id,
        )
    )
    old_inv = result.scalar_one_or_none()
    if not old_inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if old_inv.accepted_at:
        raise HTTPException(status_code=400, detail="Invitation already accepted")
    if old_inv.cancelled_at:
        raise HTTPException(status_code=400, detail="Invitation has been cancelled")

    # Issue a fresh token and extend expiry
    new_token = secrets.token_urlsafe(32)
    old_inv.cancelled_at = datetime.now(timezone.utc)
    session.add(old_inv)

    new_inv = OrgInvitationModel(
        org_id=org.id,
        invited_by_user_id=current_user.id,
        email=old_inv.email,
        role=old_inv.role,
        token=new_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    session.add(new_inv)
    await session.commit()

    await send_org_invite_email(
        to=old_inv.email,
        inviter_name=current_user.full_name or current_user.email,
        org_name=org.name,
        invite_token=new_token,
    )

    return {"ok": True, "token": new_token}


# ─── Update Seats ─────────────────────────────────────────────────────────────

class UpdateSeatsRequest(BaseModel):
    seats: int


@ORG_ROUTER.patch("/{slug}/seats")
async def update_seats(
    slug: str,
    body: UpdateSeatsRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    org, my_membership = await _get_org_and_membership(slug, current_user.id, session)

    if my_membership.role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can change seat count")
    if body.seats < 2:
        raise HTTPException(status_code=400, detail="Minimum 2 seats required")

    active = await _count_active_members(org.id, session)
    pending = await _count_pending_invites(org.id, session)
    seats_in_use = active + pending

    if body.seats < seats_in_use:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reduce seats to {body.seats}: {seats_in_use} seats are currently in use. Remove members first.",
        )

    # Downgrade to Pro if reducing to 1 (but we enforce min 2, so this handles edge case)
    if body.seats == 1:
        current_user.plan = "pro"
        session.add(current_user)

    org.seats_purchased = body.seats
    org.updated_at = datetime.now(timezone.utc)
    session.add(org)
    await session.commit()
    return {"ok": True, "seats_purchased": org.seats_purchased}


# ─── Accept Invitation ────────────────────────────────────────────────────────

@ORG_ROUTER.post("/accept-invite/{token}")
async def accept_invite(
    token: str,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(OrgInvitationModel).where(OrgInvitationModel.token == token)
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation.accepted_at:
        raise HTTPException(status_code=400, detail="Invitation already accepted")
    if invitation.cancelled_at:
        raise HTTPException(status_code=400, detail="Invitation has been cancelled")

    inv_expires = invitation.expires_at
    if inv_expires.tzinfo is None:
        inv_expires = inv_expires.replace(tzinfo=timezone.utc)
    if inv_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invitation has expired")

    # Email must match
    if current_user.email.lower() != invitation.email.lower():
        raise HTTPException(
            status_code=403,
            detail=f"This invitation was sent to {invitation.email}. Please sign in with that email address.",
        )

    # Check if already a member
    existing = await session.execute(
        select(OrgMemberModel).where(
            OrgMemberModel.org_id == invitation.org_id,
            OrgMemberModel.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already a member of this organization")

    # Seat guard on accept
    active = await _count_active_members(invitation.org_id, session)
    org = await session.get(OrganizationModel, invitation.org_id)
    if org and active >= org.seats_purchased:
        raise HTTPException(
            status_code=402,
            detail="No seats available. The team owner must add more seats before you can join.",
        )

    membership = OrgMemberModel(
        org_id=invitation.org_id,
        user_id=current_user.id,
        role=invitation.role,
        invited_by_user_id=invitation.invited_by_user_id,
    )
    session.add(membership)

    # Update user plan to team
    current_user.plan = "team"
    session.add(current_user)

    invitation.accepted_at = datetime.now(timezone.utc)
    session.add(invitation)
    await session.commit()

    # Notify team owner
    if org:
        try:
            owner_result = await session.execute(
                select(UserModel).join(OrgMemberModel, UserModel.id == OrgMemberModel.user_id).where(
                    OrgMemberModel.org_id == org.id,
                    OrgMemberModel.role == "owner",
                )
            )
            owner = owner_result.scalar_one_or_none()
            if owner and owner.id != current_user.id:
                await send_invite_accepted_email(
                    to=owner.email,
                    owner_name=owner.full_name or owner.email,
                    member_name=current_user.full_name or current_user.email,
                    org_name=org.name,
                )
        except Exception:
            pass

    return {"ok": True, "org_slug": org.slug if org else None}
