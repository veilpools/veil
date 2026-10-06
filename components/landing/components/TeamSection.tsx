"use client";

import React from "react";
import { SectionHeader } from "./SectionHeader";
import { RevealBox } from "./RevealBox";

interface TeamMember {
  name: string;
  role: string;
  photo: string;
  bio: string[];
}

const teamMembers: TeamMember[] = [
  {
    name: "Dima Khanarin",
    role: "Protocol Lead",
    photo: "/assets/dima-updated.jpg",
    bio: [
      "Former researcher at Everclear Foundation.",
      "Specializing in cross-chain zero-knowledge systems.",
    ],
  },
  {
    name: "Gleb Sidora",
    role: "ZK Engineering Lead",
    photo: "/assets/gleb-updated.jpg",
    bio: [
      "Zero-knowledge proofs and cryptography.",
      "Previously built distributed systems at Meta.",
    ],
  },
  {
    name: "Rahul Sethuram",
    role: "Uniswap v4 Architect",
    photo: "/assets/rahul-updated.jpg",
    bio: [
      "Co-founder & smart contract architect.",
      "Designed decentralized execution protocols and v4 hooks.",
    ],
  },
  {
    name: "Kevin Simback",
    role: "Protocol Operations",
    photo: "/assets/kevin-simback.jpg",
    bio: [
      "Protocol operations and ecosystem growth.",
      "Scaling on-chain liquidity on Robinhood Chain.",
    ],
  },
];

export const TeamSection: React.FC = () => {
  return (
    <section id="team" style={{ padding: "var(--section-y) var(--page-gutter)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-4)",
          alignItems: "start",
        }}
      >
        <div style={{ gridColumn: "1 / -1" }}>
          <SectionHeader
            kicker="Builders"
            title="Cryptography meets Uniswap v4 engineering."
            titleMaxW="24ch"
            kickerColor="#FF8C00"
          />
        </div>

        <RevealBox
          stagger={80}
          style={{
            gridColumn: "1 / -1",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--space-4)",
            minWidth: 0,
          }}
        >
          {teamMembers.map((member, i) => (
            <div key={i} style={{ height: "100%" }}>
              <div
                className="lp-card"
                style={{
                  background: "var(--color-panel)",
                  color: "var(--color-text)",
                  borderRadius: "var(--radius-lg)",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  boxSizing: "border-box",
                  height: "100%",
                }}
              >
                <div
                  style={{
                    aspectRatio: "1 / 1",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    background: "var(--color-panel-chip)",
                  }}
                >
                  <img
                    src={member.photo}
                    alt={member.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "center top",
                      display: "block",
                    }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-headline)",
                      fontSize: "var(--text-h3)",
                      lineHeight: 1.15,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {member.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-caption)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--color-text)",
                      marginTop: "var(--space-2)",
                    }}
                  >
                    {member.role}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  {member.bio.map((line, bIdx) => (
                    <div
                      key={bIdx}
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--text-body-sm)",
                        lineHeight: "var(--leading-body-sm)",
                        color: "var(--color-muted)",
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </RevealBox>
      </div>
    </section>
  );
};
