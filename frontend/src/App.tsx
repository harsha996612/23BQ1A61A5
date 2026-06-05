import { useState, useEffect, useCallback } from 'react';
import {
    ThemeProvider, createTheme, CssBaseline, Box, AppBar, Toolbar,
    Typography, Button, Container, Card, CardContent, Chip, Badge,
    Select, MenuItem, FormControl, InputLabel, CircularProgress,
    Snackbar, Alert, IconButton, Tooltip, Divider
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
    fetchNotifications, fetchPriorityNotifications, markAsReadAPI
} from './api';
import type { AppNotification } from './api';
import { logger } from './logger';

/* ─── Custom Dark Theme ──────────────────────────────────────── */
const appTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#64b5f6', light: '#90caf9', dark: '#42a5f5' },
        secondary: { main: '#ce93d8' },
        success: { main: '#66bb6a' },
        warning: { main: '#ffa726' },
        info: { main: '#29b6f6' },
        background: { default: '#0b1120', paper: '#121c33' },
    },
    typography: {
        fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
        h4: { fontWeight: 700, letterSpacing: '-0.02em' },
        h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid rgba(255,255,255,0.06)',
                }
            }
        }
    }
});

/* ─── Type → Color mapping ────────────────────────────────────── */
const typeColorMap: Record<string, 'success' | 'warning' | 'info'> = {
    Placement: 'success',
    Result: 'warning',
    Event: 'info',
};

/* ─── Notification Card Component ─────────────────────────────── */
function NotifCard({ notif, onMarkRead }: {
    notif: AppNotification;
    onMarkRead: (id: string) => void;
}) {
    const chipColor = typeColorMap[notif.Type] || 'info';
    const isNew = !notif.isRead;
    const ts = new Date(notif.Timestamp);
    const timeAgo = getRelativeTime(ts);

    return (
        <Card
            sx={{
                mb: 1.5,
                transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
                borderLeft: isNew ? '3px solid' : '3px solid transparent',
                borderLeftColor: isNew ? `${chipColor}.main` : 'transparent',
                bgcolor: isNew ? 'rgba(100,181,246,0.04)' : 'rgba(255,255,255,0.01)',
                opacity: isNew ? 1 : 0.65,
                '&:hover': {
                    transform: 'translateX(4px)',
                    bgcolor: 'rgba(100,181,246,0.08)',
                    opacity: 1,
                }
            }}
        >
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {isNew && (
                            <Badge color="primary" variant="dot" overlap="circular">
                                <Box sx={{ width: 8, height: 8 }} />
                            </Badge>
                        )}
                        <Chip
                            label={notif.Type}
                            color={chipColor}
                            size="small"
                            variant={isNew ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 600, fontSize: '0.7rem', minWidth: 76 }}
                        />
                        <Typography
                            variant="body2"
                            sx={{
                                fontWeight: isNew ? 600 : 400,
                                color: isNew ? 'text.primary' : 'text.secondary'
                            }}
                        >
                            {notif.Message}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Tooltip title={ts.toLocaleString()} arrow>
                            <Typography variant="caption" sx={{ color: 'text.disabled', whiteSpace: 'nowrap' }}>
                                {timeAgo}
                            </Typography>
                        </Tooltip>
                        {isNew ? (
                            <Tooltip title="Mark as read" arrow>
                                <IconButton size="small" onClick={() => onMarkRead(notif.ID)} color="primary">
                                    <DoneAllIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        ) : (
                            <Chip label="read" size="small" variant="outlined"
                                sx={{ fontSize: '0.65rem', height: 20, opacity: 0.5 }} />
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}

/* ─── Relative time helper ────────────────────────────────────── */
function getRelativeTime(date: Date): string {
    const now = Date.now();
    const diffMs = now - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
}

/* ─── Main App ────────────────────────────────────────────────── */
function App() {
    const [view, setView] = useState<'all' | 'priority'>('all');
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [filterType, setFilterType] = useState('');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
        open: false, msg: '', severity: 'success'
    });

    const loadAll = useCallback(async () => {
        setLoading(true);
        const data = await fetchNotifications();
        setNotifications(data);
        setLoading(false);
    }, []);

    const loadPriority = useCallback(async (typeFilter?: string) => {
        setLoading(true);
        const data = await fetchPriorityNotifications(10, typeFilter || undefined);
        setNotifications(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (view === 'all') loadAll();
        else loadPriority(filterType);
    }, [view, filterType, loadAll, loadPriority]);

    const handleRead = async (id: string) => {
        const ok = await markAsReadAPI(id);
        if (ok) {
            logger.info('Marked notification as read: ' + id);
            setNotifications(prev => prev.map(n => n.ID === id ? { ...n, isRead: true } : n));
            setToast({ open: true, msg: 'Marked as read', severity: 'success' });
        } else {
            setToast({ open: true, msg: 'Failed to update', severity: 'error' });
        }
    };

    const handleFilterChange = (e: SelectChangeEvent<string>) => setFilterType(e.target.value);

    const switchView = (v: 'all' | 'priority') => {
        setView(v);
        setFilterType('');
    };

    const refresh = () => {
        if (view === 'all') loadAll();
        else loadPriority(filterType);
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <ThemeProvider theme={appTheme}>
            <CssBaseline />
            <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>

                {/* ── Top Bar ───────────────────────────────────── */}
                <AppBar position="sticky" elevation={0}
                    sx={{ bgcolor: 'rgba(11,17,32,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <Toolbar>
                        <NotificationsActiveIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                            Affordmed
                        </Typography>
                        <Button
                            variant={view === 'all' ? 'contained' : 'text'}
                            size="small"
                            onClick={() => switchView('all')}
                            startIcon={<NotificationsActiveIcon />}
                            sx={{ mr: 1, textTransform: 'none' }}
                        >
                            All
                            {unreadCount > 0 && view === 'all' && (
                                <Chip label={unreadCount} size="small" color="error"
                                    sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
                            )}
                        </Button>
                        <Button
                            variant={view === 'priority' ? 'contained' : 'text'}
                            size="small"
                            onClick={() => switchView('priority')}
                            startIcon={<PriorityHighIcon />}
                            sx={{ textTransform: 'none' }}
                        >
                            Priority
                        </Button>
                    </Toolbar>
                </AppBar>

                {/* ── Content ───────────────────────────────────── */}
                <Container maxWidth="md" sx={{ pt: 4, pb: 6 }}>

                    {/* Header row */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Box>
                            <Typography variant="h4">
                                {view === 'all' ? 'Notifications' : 'Priority Inbox'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.disabled', mt: 0.5 }}>
                                {view === 'all'
                                    ? `${notifications.length} notifications · ${unreadCount} unread`
                                    : 'Top 10 by importance (Placement > Result > Event)'}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {view === 'priority' && (
                                <FormControl size="small" sx={{ minWidth: 140 }}>
                                    <InputLabel>Type</InputLabel>
                                    <Select value={filterType} label="Type" onChange={handleFilterChange}>
                                        <MenuItem value=""><em>All</em></MenuItem>
                                        <MenuItem value="Placement">Placement</MenuItem>
                                        <MenuItem value="Result">Result</MenuItem>
                                        <MenuItem value="Event">Event</MenuItem>
                                    </Select>
                                </FormControl>
                            )}
                            <Tooltip title="Refresh" arrow>
                                <IconButton onClick={refresh} color="primary" size="small">
                                    <RefreshIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>

                    <Divider sx={{ mb: 2.5, borderColor: 'rgba(255,255,255,0.06)' }} />

                    {/* Loading */}
                    {loading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress size={36} />
                        </Box>
                    )}

                    {/* List */}
                    {!loading && notifications.map(n => (
                        <NotifCard key={n.ID} notif={n} onMarkRead={handleRead} />
                    ))}

                    {/* Empty state */}
                    {!loading && notifications.length === 0 && (
                        <Box sx={{ textAlign: 'center', py: 8 }}>
                            <NotificationsActiveIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                            <Typography color="text.secondary">No notifications found</Typography>
                        </Box>
                    )}
                </Container>
            </Box>

            {/* ── Toast ─────────────────────────────────────────── */}
            <Snackbar open={toast.open} autoHideDuration={2500}
                onClose={() => setToast(p => ({ ...p, open: false }))}>
                <Alert severity={toast.severity} variant="filled" sx={{ width: '100%' }}>
                    {toast.msg}
                </Alert>
            </Snackbar>
        </ThemeProvider>
    );
}

export default App;
