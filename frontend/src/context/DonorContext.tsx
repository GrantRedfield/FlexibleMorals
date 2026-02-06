import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { getBulkDonorStatus, getMyDonorStatus } from "../utils/api";

interface DonorStatus {
  tier: "supporter" | "patron" | "benefactor" | null;
  badge: string | null;
  totalDonated?: number;
}

interface MyDonorStatus extends DonorStatus {
  isDonor: boolean;
  linkedEmail: string | null;
  nextTier: string | null;
  amountToNextTier: number;
  firstDonationAt?: string;
  lastDonationAt?: string;
}

interface DonorContextType {
  donorStatuses: Record<string, DonorStatus>;
  myDonorStatus: MyDonorStatus | null;
  loadDonorStatuses: (usernames: string[]) => Promise<void>;
  loadMyDonorStatus: (username: string) => Promise<void>;
  getDonorStatus: (username: string) => DonorStatus | null;
  clearCache: () => void;
}

const DonorContext = createContext<DonorContextType | undefined>(undefined);

export function DonorProvider({ children }: { children: ReactNode }) {
  const [donorStatuses, setDonorStatuses] = useState<Record<string, DonorStatus>>({});
  const [myDonorStatus, setMyDonorStatus] = useState<MyDonorStatus | null>(null);
  const [loadedUsernames, setLoadedUsernames] = useState<Set<string>>(new Set());

  // Load donor statuses for multiple usernames (batch)
  const loadDonorStatuses = useCallback(async (usernames: string[]) => {
    // Filter out already loaded usernames
    const newUsernames = usernames.filter((u) => !loadedUsernames.has(u));
    if (newUsernames.length === 0) return;

    try {
      const response = await getBulkDonorStatus(newUsernames);
      const donors = response.donors || {};

      setDonorStatuses((prev) => ({
        ...prev,
        ...donors,
      }));

      setLoadedUsernames((prev) => {
        const updated = new Set(prev);
        newUsernames.forEach((u) => updated.add(u));
        return updated;
      });
    } catch (err) {
      console.error("Failed to load donor statuses:", err);
    }
  }, [loadedUsernames]);

  // Load current user's full donor status
  const loadMyDonorStatus = useCallback(async (username: string) => {
    try {
      const status = await getMyDonorStatus(username);
      setMyDonorStatus(status);
    } catch (err) {
      console.error("Failed to load my donor status:", err);
    }
  }, []);

  // Get donor status for a single username (from cache)
  const getDonorStatus = useCallback((username: string): DonorStatus | null => {
    return donorStatuses[username] || null;
  }, [donorStatuses]);

  // Clear all cached data
  const clearCache = useCallback(() => {
    setDonorStatuses({});
    setMyDonorStatus(null);
    setLoadedUsernames(new Set());
  }, []);

  return (
    <DonorContext.Provider
      value={{
        donorStatuses,
        myDonorStatus,
        loadDonorStatuses,
        loadMyDonorStatus,
        getDonorStatus,
        clearCache,
      }}
    >
      {children}
    </DonorContext.Provider>
  );
}

export function useDonor() {
  const ctx = useContext(DonorContext);
  if (!ctx) throw new Error("useDonor must be used within DonorProvider");
  return ctx;
}
