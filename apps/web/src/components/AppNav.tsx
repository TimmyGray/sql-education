"use client";

import * as React from "react";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { alpha } from "@mui/material/styles";
import { useAuth } from "@/lib/auth-context";
import { BrandMark } from "@/components/auth/BrandMark";

interface NavLink {
  label: string;
  href: string;
}

const NAV_LINKS: readonly NavLink[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Account", href: "/account" },
];

/** Initials shown in the avatar — from displayName, else the email. */
function initialsOf(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/**
 * Top navigation bar for authenticated pages. Brand + section links + the
 * current user's identity and a Logout action. Collapses to a hamburger drawer
 * on small screens. The orchestrator renders this above protected content.
 */
export function AppNav(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);

  const displayName = user?.displayName?.trim() || null;
  const email = user?.email ?? "";

  const isActive = React.useCallback(
    (href: string) => pathname === href || pathname?.startsWith(`${href}/`),
    [pathname],
  );

  const handleLogout = React.useCallback(async () => {
    setMenuAnchor(null);
    setDrawerOpen(false);
    await logout();
    router.replace("/login");
  }, [logout, router]);

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        color="inherit"
        sx={{
          bgcolor: alpha("#ffffff", 0.85),
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: { xs: 60, sm: 68 } }}>
          {/* Mobile: hamburger. */}
          <IconButton
            edge="start"
            aria-label="Open navigation menu"
            onClick={() => setDrawerOpen(true)}
            sx={{ display: { xs: "inline-flex", md: "none" }, mr: 0.5 }}
          >
            <MenuIcon />
          </IconButton>

          <Box
            component={NextLink}
            href="/dashboard"
            aria-label="SQL Education home"
            sx={{ display: "inline-flex", textDecoration: "none", mr: 2 }}
          >
            <BrandMark size="sm" />
          </Box>

          {/* Desktop links. */}
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ display: { xs: "none", md: "flex" } }}
          >
            {NAV_LINKS.map((link) => (
              <Button
                key={link.href}
                component={NextLink}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                sx={{
                  color: isActive(link.href) ? "primary.main" : "text.secondary",
                  fontWeight: isActive(link.href) ? 700 : 500,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                {link.label}
              </Button>
            ))}
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          {/* Desktop: identity + account menu. */}
          <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center" }}>
            <Button
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label="Account menu"
              aria-haspopup="true"
              aria-expanded={menuAnchor ? "true" : undefined}
              sx={{
                textTransform: "none",
                color: "text.primary",
                gap: 1.25,
                pl: 1,
                pr: 1.5,
                borderRadius: 999,
              }}
              endIcon={undefined}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: 13,
                  fontWeight: 700,
                  bgcolor: "primary.main",
                }}
              >
                {user ? initialsOf(displayName, email) : ""}
              </Avatar>
              <Box sx={{ textAlign: "left", lineHeight: 1.1 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, maxWidth: 160 }}
                  noWrap
                >
                  {displayName ?? email}
                </Typography>
                {displayName ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", maxWidth: 160 }}
                    noWrap
                  >
                    {email}
                  </Typography>
                ) : null}
              </Box>
            </Button>
          </Box>

          {/* Mobile (xs only): a compact logout icon so it's always reachable. */}
          <IconButton
            aria-label="Log out"
            onClick={handleLogout}
            sx={{ display: { xs: "inline-flex", sm: "none" } }}
          >
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Account dropdown (>= sm). */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 1, minWidth: 220, borderRadius: 2 } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {displayName ?? "Signed in"}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {email}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          component={NextLink}
          href="/account"
          onClick={() => setMenuAnchor(null)}
        >
          <ListItemIcon>
            <PersonOutlineIcon fontSize="small" />
          </ListItemIcon>
          Account
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Log out
        </MenuItem>
      </Menu>

      {/* Mobile drawer. */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: 280 } } }}
      >
        <Box sx={{ p: 2.5 }}>
          <BrandMark size="sm" />
        </Box>
        <Divider />
        {user ? (
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ px: 2.5, py: 2 }}
          >
            <Avatar
              sx={{ bgcolor: "primary.main", fontSize: 14, fontWeight: 700 }}
            >
              {initialsOf(displayName, email)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {displayName ?? email}
              </Typography>
              {displayName ? (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {email}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        ) : null}
        <Divider />
        <List sx={{ flexGrow: 1 }}>
          {NAV_LINKS.map((link) => (
            <ListItem key={link.href} disablePadding>
              <ListItemButton
                component={NextLink}
                href={link.href}
                selected={Boolean(isActive(link.href))}
                onClick={() => setDrawerOpen(false)}
              >
                <ListItemText primary={link.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Log out" />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
    </>
  );
}

export default AppNav;
