<script lang="ts">
  import "figma-plugin-ds/dist/figma-plugin-ds.css";
  import { MESSAGE } from "./constants";
  import { InitialStyle } from "./types";

  let stylesList: InitialStyle[] = [];

  let patternValue = "$N $A%";
  let opacitiesValue = "80, 60, 40, 20, 10";
  let shouldCleanValue = false;
  let stylesToChange: InitialStyle[] = [];

  onmessage = (event: MessageEvent) => {
    switch (event.data.pluginMessage.type) {
      case MESSAGE.INIT_STYLES:
        stylesList = event.data.pluginMessage.styles;
        stylesToChange = [...stylesList];
        break;
      case MESSAGE.INIT_PARAMS:
        const { opacities, pattern, shouldClean } =
          event.data.pluginMessage.params;
        if (opacities) opacitiesValue = opacities.join(", ");
        if (pattern) patternValue = pattern;
        if (shouldClean) shouldCleanValue = shouldClean;
        break;
      default:
        break;
    }
    return;
  };

  const updateStylesToChange = (item: InitialStyle, event: Event) => {
    const inputElement = event.target as HTMLInputElement;
    const checked = inputElement.checked;
    if (checked) {
      stylesToChange = [...stylesToChange, item];
    } else {
      stylesToChange = stylesToChange.filter((i) => i !== item);
    }

    return !!stylesToChange.find((i) => i === item);
  };

  const selectAllStyles = (event: Event) => {
    const inputElement = event.target as HTMLInputElement;
    const checked = inputElement.checked;
    if (checked) {
      stylesToChange = stylesList;
    } else {
      stylesToChange = [];
    }
  };

  $: opacitiesList = opacitiesValue
    .split(",")
    .map((x) => parseInt(x.trim()))
    .sort((a, b) => b - a)
    .filter((x) => x >= 0 && x <= 100);

  const matchNamePattern = (input: string, variables: any) => {
    const pattern = /\$(N|A)/g;

    const replaced = input.replace(pattern, (match, name) => {
      const value = variables[name];

      return value !== undefined ? value : match;
    });

    return replaced;
  };

  const handlePatternAdd = (value: string) => {
    patternValue += value;
  };

  const handleClick = () => {
    parent.postMessage(
      {
        pluginMessage: {
          type: MESSAGE.SYNC_STYLES,
          opacities: opacitiesList,
          pattern: patternValue,
          shouldClean: shouldCleanValue,
          toSync: stylesToChange,
        },
      },
      "*"
    );
  };
</script>

<div class="content">
  <div class="container">
    <span class="type type--small type--secondary">
      Sync and update solid colors and matching opacity styles in the local
      library.
    </span>
    <div class="input-content">
      <label for="opacity-styles" class="type">Opacity styles:</label>
      <div class="input">
        <input
          id="opacity-styles"
          name="opacity-styles"
          type="input"
          class="input__field"
          placeholder="e.g. 10, 20, 40, 60, 80"
          bind:value={opacitiesValue}
        />
      </div>
      <span class="type type--tertiary">
        Enter values in [0-100] range separated with commas
      </span>
    </div>
    <div class="input-content">
      <div class="type">Name pattern:</div>
      <div class="input">
        <input
          type="input"
          class="input__field"
          placeholder="e.g. $N - $A%"
          bind:value={patternValue}
        />
      </div>
      <div class="button-row">
        <button
          class="button button--secondary"
          on:click={() => handlePatternAdd("$N")}>Style name</button
        >
        <button
          class="button button--secondary"
          on:click={() => handlePatternAdd("$A")}>Opacity</button
        >
      </div>
    </div>
  </div>
  <div class="container preview">
    <div class="preview-header">
      <div class="type type--small type--bold">Preview</div>
      <div class="checkbox preview">
        <input
          id="selectAllStyles"
          type="checkbox"
          class="checkbox__box"
          checked={stylesList.length === stylesToChange.length}
          on:change={(e) => selectAllStyles(e)}
        />
        <label for="selectAllStyles" class="checkbox__label">Sync all</label>
      </div>
    </div>
    <div class="style-list">
      {#each stylesList as stylesItem}
        <div class="opacity-list">
          <div class="checkbox preview">
            <input
              id={stylesItem.id}
              type="checkbox"
              class="checkbox__box"
              checked={!!stylesToChange.find((i) => i === stylesItem)}
              on:change={(e) => updateStylesToChange(stylesItem, e)}
            />
            <label for={stylesItem.id} class="checkbox__label"
              ><strong>{stylesItem.name}</strong></label
            >
          </div>
          <div class="color-style">
            <div class="color-style-circle">
              <div class="color-style-circle__checkered" />
              <div class="color-style-circle__opaque" />
              <div
                class="color-style-circle__solid"
                style:background-color={`rgba(${stylesItem.color.r * 255}, ${
                  stylesItem.color.g * 255
                }, ${stylesItem.color.b * 255}, 1)`}
              />
              <div class="color-style-circle__border" />
            </div>
            <span class="type type--small">
              {stylesItem.name}
            </span>
          </div>
          {#each opacitiesList as opacityItem}
            <div class="color-style">
              <div class="color-style-circle">
                <div class="color-style-circle__checkered" />
                <div class="color-style-circle__opaque" />
                <div
                  class="color-style-circle__solid"
                  style:background-color={`rgba(${stylesItem.color.r * 255}, ${
                    stylesItem.color.g * 255
                  }, ${stylesItem.color.b * 255}, ${opacityItem / 100})`}
                />
                <div class="color-style-circle__border" />
              </div>
              <span class="color-style-text type type--small">
                {matchNamePattern(patternValue, {
                  N: stylesItem.name,
                  A: opacityItem,
                }) || "Untitled"}
              </span>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
  <div class="footer">
    <div class="checkbox">
      <input
        id="shouldClean"
        type="checkbox"
        class="checkbox__box"
        bind:checked={shouldCleanValue}
      />
      <label for="shouldClean" class="checkbox__label"
        >Clean up unused opacity styles</label
      >
    </div>
    <button
      class="button button--primary"
      disabled={opacitiesValue === "" || patternValue === ""}
      on:click={handleClick}>Create & sync styles</button
    >
  </div>
</div>

<style lang="scss">
  @import "./overrides.scss";

  .content {
    height: 100vh;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 200px;
    grid-template-rows: 256px auto;
    grid-gap: 1px;
    background-color: var(--figma-color-border);
    color: var(--figma-color-text);
  }

  .container {
    flex: 1 1 50%;
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 16px 16px 16px;
    background-color: var(--figma-color-bg);

    &.preview {
      background-color: var(--figma-color-bg-secondary);
      padding: 0;
    }
  }

  .preview-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--figma-color-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .input-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .button-row {
    display: flex;
    gap: 8px;
  }

  .style-list {
    width: 100%;

    display: flex;
    flex-direction: column;
    gap: 20px;
    flex: 1 1 100%;
    overflow-y: auto;
    padding: 16px;
    scroll-padding-top: 16px;
    scroll-padding-bottom: 16px;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .opacity-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .color-style {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .color-style-circle {
    position: relative;
    height: 16px;
    width: 16px;
    border-radius: 50%;

    &__checkered {
      position: absolute;
      height: 16px;
      width: 16px;
      border-radius: 50%;
      background: linear-gradient(
          45deg,
          rgba(0, 0, 0, 0.0980392) 25%,
          transparent 25%,
          transparent 75%,
          rgba(0, 0, 0, 0.0980392) 75%,
          rgba(0, 0, 0, 0.0980392) 0
        ),
        linear-gradient(
          45deg,
          rgba(0, 0, 0, 0.0980392) 25%,
          transparent 25%,
          transparent 75%,
          rgba(0, 0, 0, 0.0980392) 75%,
          rgba(0, 0, 0, 0.0980392) 0
        ),
        white;
      background-repeat: repeat, repeat;
      background-position:
        0px 0,
        4px 4px;
      transform-origin: 0 0 0;
      background-origin: padding-box, padding-box;
      background-clip: border-box, border-box;
      background-size:
        8px 8px,
        8px 8px;
    }

    &__opaque {
      position: absolute;
      height: 16px;
      width: 16px;
      border-radius: 50%;
      background: linear-gradient(
        45deg,
        var(--figma-color-bg-secondary) 50%,
        transparent 50%
      );
    }

    &__solid {
      position: absolute;
      height: 16px;
      width: 16px;
      border-radius: 50%;
    }

    &__border {
      position: absolute;
      height: 18px;
      width: 18px;
      left: -1px;
      top: -1px;

      border-radius: 50%;
      box-shadow: inset 0 0 0 1.5px var(--figma-color-bg-secondary);
    }
  }

  .color-style-text {
    overflow-x: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .footer {
    background-color: var(--figma-color-bg);
    grid-column: 1 / span 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
  }
</style>
