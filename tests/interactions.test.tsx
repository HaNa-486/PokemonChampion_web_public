import { clear, get, keys } from "idb-keyval";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MoveDatabaseV2 } from "../components/DatabaseViews";
import { SpeedChart } from "../components/SpeedChart";
import { TeamTransferPanel } from "../components/TeamTransfer";
import { NEUTRAL_NATURE, ZERO_STATS } from "../lib/domain";
import { exportTeamTransfer } from "../lib/team-transfer";
import { parseTeamPlans, useTeamPlansStore } from "../lib/team-plans-store";
import { useTeamStore } from "../lib/team-store";
import type { TeamMember } from "../lib/types";

beforeEach(async () => {
  await clear();
  useTeamPlansStore.setState({ plans: [], hydrated: false, hydrationError: false, saveStatus: "saved" });
  useTeamStore.setState({ teams: { singles: [], doubles: [] }, hydrated: true, saveStatus: "saved" });
});

describe("catalog interactions", () => {
  it("filters positive priority, searches, and resets the filters", async () => {
    const user = userEvent.setup();
    render(<MoveDatabaseV2 locale="en" />);
    await user.click(screen.getByRole("button", { name: "+ Positive" }));
    expect(screen.getByRole("button", { name: "Extreme Speed" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Earthquake" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Search moves" }), "Extreme");
    expect(screen.getByRole("button", { name: "Extreme Speed" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByRole("textbox", { name: "Search moves" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "+ Positive" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Earthquake" })).toBeInTheDocument();
  });

  it("opens a move's available Pokémon and closes the dialog from the keyboard", async () => {
    const user = userEvent.setup();
    render(<MoveDatabaseV2 locale="en" />);
    await user.type(screen.getByRole("textbox", { name: "Search moves" }), "Dragon Claw");
    await user.click(screen.getByRole("button", { name: "Dragon Claw" }));
    const dialog = screen.getByRole("dialog", { name: "Dragon Claw" });
    expect(within(dialog).getByText("Garchomp")).toBeInTheDocument();
    expect(within(dialog).getByText("Dragonite")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Dragon Claw" })).not.toBeInTheDocument();
  });
});

it("loads four demo speed participants on both sides and recalculates valid battlefield changes", async () => {
  const user = userEvent.setup();
  render(<SpeedChart locale="en" format="doubles" />);
  await user.click(screen.getByRole("button", { name: "Load demo example" }));
  const participant = (name: string, side: string) => screen.getByRole("button", { name: new RegExp(`^${name} · ${side} · .* · Edit$`) });
  const position = (name: string) => parseFloat(participant(name, "Enemy").parentElement!.style.left);
  const expectValidRoster = () => {
    expect(screen.getAllByRole("button", { name: / · Own · .* · Edit$/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: / · Enemy · .* · Edit$/ })).toHaveLength(2);
    expect(participant("Garchomp", "Own")).toBeInTheDocument();
    expect(participant("Venusaur", "Own")).toBeInTheDocument();
    expect(participant("Gengar", "Enemy")).toHaveAccessibleName("Gengar · Enemy · 178 · Edit");
    expect(participant("Snorlax", "Enemy")).toHaveAccessibleName("Snorlax · Enemy · 45 · Edit");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  };

  expectValidRoster();
  expect(screen.getByRole("combobox", { name: "Weather" })).toHaveValue("sun");
  expect(participant("Venusaur", "Own")).toHaveAccessibleName("Venusaur · Own · 180–290 · Edit");
  expect(position("Gengar")).toBeLessThan(position("Snorlax"));

  await user.selectOptions(screen.getByRole("combobox", { name: "Weather" }), "rain");
  expect(screen.getByRole("status", { name: "Current battlefield" })).toHaveTextContent("Rain");
  expect(participant("Venusaur", "Own")).toHaveAccessibleName("Venusaur · Own · 90–145 · Edit");
  await user.click(screen.getByRole("button", { name: "OWN SIDE Tailwind OFF" }));
  expect(participant("Venusaur", "Own")).toHaveAccessibleName("Venusaur · Own · 180–290 · Edit");
  expectValidRoster();

  await user.click(screen.getByRole("button", { name: "Trick Room OFF" }));
  expect(screen.getByRole("button", { name: "Trick Room ON" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Slower first")).toBeInTheDocument();
  expect(position("Snorlax")).toBeLessThan(position("Gengar"));
  expectValidRoster();
});

it("previews and cancels an import without writes, then saves a new plan without replacing the team", async () => {
  const original: TeamMember = {
    id: "original", pokemonId: "dragonite", abilityId: "multiscale", itemId: null,
    moveIds: ["dragon-claw"], ap: { ...ZERO_STATS }, nature: { ...NEUTRAL_NATURE },
  };
  const incoming: TeamMember = { ...original, id: "incoming", pokemonId: "garchomp", abilityId: "sand-veil" };
  useTeamStore.setState({ teams: { singles: [], doubles: [original] } });
  const exported = exportTeamTransfer("Imported demo", "doubles", [incoming]);
  render(<TeamTransferPanel initial={exported} />);
  fireEvent.click(screen.getByRole("button", { name: /Preview & validate/ }));
  expect(await keys()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
  expect(await keys()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: /Preview & validate/ }));
  fireEvent.click(screen.getByRole("button", { name: /Confirm new plan/ }));
  await screen.findByRole("status");
  const [key] = await keys();
  expect(parseTeamPlans(await get(key))).toHaveLength(1);
  expect(parseTeamPlans(await get(key))[0]).toMatchObject({ name: "Imported demo", format: "doubles" });
  expect(useTeamStore.getState().teams.doubles).toEqual([original]);
});
