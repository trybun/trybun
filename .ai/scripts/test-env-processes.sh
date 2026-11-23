# shellcheck shell=sh
# The identity check of the QA test environment's applications (#453, shared since #456), sourced
# by test-env-up.sh (its reuse check and the watch of --foreground) and test-env-down.sh (which
# signals only the groups it confirms). A "running" descriptor left by a crash with no --foreground
# owner or a reboot records PIDs the kernel may have given to other programs: a live PID alone never
# proves that it is still an application of the environment. Not part of the om-prepare-test-env
# generator: regenerating the two entrypoints must keep sourcing it (.ai/memory/e2e.md). Linux only
# (/proc), as setsid in test-env-up.sh already is.

# The start of process $1 in clock ticks since the boot, which no clock change moves; nothing for a
# zombie (it no longer holds a port) or a missing process – which may have exited a moment after
# `ps` listed it: never a failure that `set -e` would stop the caller on.
proc_ticks() { awk '{ sub(/.*\) /, "") } $1 != "Z" { print $20 }' "/proc/$1/stat" 2>/dev/null || true; }

# The PIDs of the processes of process group $1.
group_members() { ps -e -o pid= -o pgid= | awk -v group="$1" '$2 == group { print $1 }'; }

# Whether recorded process group $1 is an application of the environment with run id $2, whose
# descriptor has runIdInEnvironment $3 and startedAt $4. In a subshell, so its variables never
# change the caller's.
group_is_ours() (
  [ -n "$2" ] || exit 1
  # test-env-up.sh starts every process of the applications with the run id of the boot as
  # TEST_ENV_RUN_ID, they inherit it, and the descriptor says so (runIdInEnvironment): the group is
  # the environment's while a member carries it – also after the leader exited first, as `sh -c`
  # does on SIGTERM while the API runs its shutdown hooks. A group whose PID the kernel gave to
  # another program holds no such member, and while the group exists the kernel gives its PID to
  # no new process.
  if [ "$3" = true ]; then
    for member in $(group_members "$1"); do
      # Unreadable for a zombie and for another user's process.
      if tr '\0' '\n' 2>/dev/null <"/proc/$member/environ" | grep -Fqx "TEST_ENV_RUN_ID=$2"; then
        exit 0
      fi
    done
    exit 1
  fi
  # A boot before #453 started its applications without the run id. Its leader is still the one it
  # recorded while it runs and started shortly before startedAt (the boot waits at most 180 s for
  # their health, and writes the descriptor seconds after starting them): that PID has not been free
  # since, and after a reboot every process starts later. This reads the wall clock, which a
  # backward step after the boot would fool, so it stays the fallback of these descriptors only.
  # btime is whole seconds, so the start comes out up to 1 s early.
  start=$(proc_ticks "$1")
  [ -n "$start" ] && [ -n "$4" ] || exit 1
  at=$(date -u -d "$4" +%s 2>/dev/null) || exit 1
  awk -v boot="$(awk '/^btime / { print $2 }' /proc/stat 2>/dev/null)" -v hz="$(getconf CLK_TCK)" \
    -v start="$start" -v at="$at" \
    'BEGIN { s = boot + start / hz; exit !(boot > 0 && s <= at - 1 && s >= at - 300) }'
)
