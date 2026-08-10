/*
  DETTE ER FILEN DU NORMALT REDIGERER.

  Tilføj en ny side ved at kopiere ét objekt i pages-listen.
*/
window.HUB_CONFIG = {
  brand: "KasperLab",
  eyebrow: "PROJECT HUB",
  title: "Alt samlet ét sted.",
  tagline: "Projekter, værktøjer, D&D, MTG og andet, der får sin egen lille gren.",
  footer: "Bygget som statisk GitHub Pages-site.",

  pages: [
    {
      title: "MTG",
      description: "Magic: The Gathering-værktøjer og deckbuilding.",
      href: "./mtg/",
      category: "MTG",
      icon: "M",
      badge: ""
    },
    {
      title: "MTG Oracle Exporter",
      description: "Eksportér Oracle-tekst fra en deckliste direkte i browseren.",
      href: "./mtg/oracle/",
      category: "MTG",
      icon: "O",
      badge: "Ny"
    },
    {
      title: "D&D",
      description: "Kampagnesider, handouts, wiki og rollespilsmateriale.",
      href: "./dnd/",
      category: "D&D",
      icon: "D",
      badge: ""
    },
    {
      title: "Tools",
      description: "Små webværktøjer til tekst, Windows, AutoHotkey og andet.",
      href: "./tools/",
      category: "Tools",
      icon: "T",
      badge: ""
    },
    {
      title: "Blog",
      description: "Noter, projekter og længere indlæg.",
      href: "./blog/",
      category: "Blog",
      icon: "B",
      badge: ""
    }

    /*
    NY SIDE - EKSEMPEL:

    ,{
      title: "Text Tools",
      description: "Ryd, sortér og konvertér tekst.",
      href: "./tools/text/",
      category: "Tools",
      icon: "Tx",
      badge: "Ny"
    }
    */
  ]
};
